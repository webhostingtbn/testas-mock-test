-- Fix figure_sequence and numerical_series scoring in private.submit_attempt_transaction_v2
-- Also backfill historical completed attempts in public.user_exams

CREATE OR REPLACE FUNCTION private.submit_attempt_transaction_v2(
  p_attempt_id UUID,
  p_user_id UUID,
  p_user_answers JSONB,
  p_completion_reason TEXT DEFAULT 'finished'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
DECLARE
  v_attempt RECORD;
  v_question RECORD;
  v_correct_json JSONB;
  v_user_ans_json JSONB;
  v_user_ans_normalized JSONB;
  v_score INT := 0;
  v_total INT := 0;
  v_answered_count INT := 0;
  v_results JSONB := '[]'::jsonb;
  v_is_correct BOOLEAN;
  v_is_answered BOOLEAN;
BEGIN
  IF p_completion_reason IS NULL OR p_completion_reason NOT IN ('finished', 'ended_early') THEN
    RAISE EXCEPTION 'Invalid completion reason: %', p_completion_reason USING ERRCODE = 'P0005';
  END IF;

  IF p_user_answers IS NULL OR jsonb_typeof(p_user_answers) <> 'object' THEN
    RAISE EXCEPTION 'User answers must be a JSON object' USING ERRCODE = 'P0006';
  END IF;

  -- Row locking and ownership verification
  SELECT * INTO v_attempt
  FROM public.user_exams
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or user unauthorized' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check: if already completed, return existing completed metrics unchanged
  IF v_attempt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'score', COALESCE(v_attempt.total_score, 0),
      'total', COALESCE(v_attempt.max_score, 0),
      'answered_count', COALESCE(v_attempt.answered_count, 0),
      'completion_reason', COALESCE(v_attempt.completion_reason, 'finished'),
      'completed_at', v_attempt.completed_at
    );
  END IF;

  -- Refuse to score an exam with incomplete answer-key data. Silently treating
  -- an unscoreable question as incorrect would corrupt both full and partial metrics.
  IF EXISTS (
    SELECT 1
    FROM public.questions AS question
    JOIN public.sections AS section ON section.id = question.section_id
    LEFT JOIN private.question_answers AS answer_key ON answer_key.question_id = question.id
    WHERE section.exam_id = v_attempt.exam_id
      AND answer_key.question_id IS NULL
  ) THEN
    RAISE EXCEPTION 'ANSWER_KEY_MISSING' USING ERRCODE = 'P0007';
  END IF;

  FOR v_question IN
    SELECT q.id, q.question_type, qa.correct_answer
    FROM public.questions q
    JOIN public.sections s ON s.id = q.section_id
    JOIN private.question_answers qa ON qa.question_id = q.id
    WHERE s.exam_id = v_attempt.exam_id
  LOOP
    v_total := v_total + 1;
    v_correct_json := v_question.correct_answer;
    v_user_ans_json := p_user_answers -> v_question.id::text;

    -- Precise SQL definition of answered: key exists and JSON type is not 'null'
    v_is_answered := (
      p_user_answers ? v_question.id::TEXT
      AND jsonb_typeof(v_user_ans_json) <> 'null'
    );
    IF v_is_answered THEN
      v_answered_count := v_answered_count + 1;
    END IF;

    -- Answer normalization for evaluation:
    v_user_ans_normalized := v_user_ans_json;
    IF v_is_answered THEN
      -- 1. Figure Sequence: {"image1": X, "image2": Y} -> [X, Y]
      IF jsonb_typeof(v_user_ans_json) = 'object' 
         AND v_user_ans_json ? 'image1' 
         AND v_user_ans_json ? 'image2' THEN
        IF v_user_ans_json->'image1' IS NOT NULL 
           AND v_user_ans_json->'image2' IS NOT NULL 
           AND jsonb_typeof(v_user_ans_json->'image1') <> 'null' 
           AND jsonb_typeof(v_user_ans_json->'image2') <> 'null' THEN
          v_user_ans_normalized := jsonb_build_array(v_user_ans_json->'image1', v_user_ans_json->'image2');
        END IF;
      -- 2. Numerical Series: string vs number coercion (e.g. "94" vs 94)
      ELSIF jsonb_typeof(v_user_ans_json) = 'string' AND jsonb_typeof(v_correct_json) = 'number' THEN
        IF trim(both '"' from v_user_ans_json::text) = v_correct_json::text THEN
          v_user_ans_normalized := v_correct_json;
        END IF;
      END IF;
    END IF;

    v_is_correct := (v_is_answered AND v_correct_json IS NOT NULL AND v_user_ans_normalized = v_correct_json);
    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    v_results := v_results || jsonb_build_object(
      'question_id', v_question.id,
      'user_answer', v_user_ans_json,
      'is_correct', v_is_correct,
      'is_answered', v_is_answered
    );
  END LOOP;

  UPDATE public.user_exams
  SET status = 'completed',
      completion_reason = p_completion_reason,
      answered_count = v_answered_count,
      total_score = v_score,
      max_score = v_total,
      detailed_results = jsonb_build_object(
        'answers', v_results,
        'completion_reason', p_completion_reason,
        'answered_count', v_answered_count
      ),
      user_answers = p_user_answers,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'score', v_score,
    'total', v_total,
    'answered_count', v_answered_count,
    'completion_reason', p_completion_reason,
    'results', v_results,
    'completed_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) TO service_role, postgres;

-- -------------------------------------------------------------
-- Backfill historical completed attempts in public.user_exams
-- -------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_new_answers JSONB;
  v_new_score INT;
  ans RECORD;
  v_ans_is_correct BOOLEAN;
  v_correct_answer JSONB;
  v_q_type TEXT;
  v_user_ans JSONB;
  v_normalized_user_ans JSONB;
  v_changed BOOLEAN;
BEGIN
  FOR r IN 
    SELECT ue.id, ue.detailed_results
    FROM public.user_exams ue
    WHERE ue.status = 'completed' AND ue.detailed_results IS NOT NULL
  LOOP
    v_new_answers := '[]'::jsonb;
    v_new_score := 0;
    v_changed := false;

    FOR ans IN 
      SELECT 
        elem->>'question_id' as question_id,
        elem->'user_answer' as user_answer,
        elem->'is_answered' as is_answered,
        elem->'is_correct' as is_correct
      FROM jsonb_array_elements(r.detailed_results->'answers') elem
    LOOP
      SELECT qa.correct_answer, q.question_type 
      INTO v_correct_answer, v_q_type
      FROM private.question_answers qa
      JOIN public.questions q ON q.id = qa.question_id
      WHERE qa.question_id = ans.question_id::uuid;

      v_user_ans := ans.user_answer;
      v_ans_is_correct := COALESCE((ans.is_correct)::boolean, false);
      v_normalized_user_ans := v_user_ans;

      IF v_user_ans IS NOT NULL AND jsonb_typeof(v_user_ans) <> 'null' THEN
        -- Figure Sequence
        IF jsonb_typeof(v_user_ans) = 'object' AND v_user_ans ? 'image1' AND v_user_ans ? 'image2' THEN
          IF v_user_ans->'image1' IS NOT NULL AND v_user_ans->'image2' IS NOT NULL
             AND jsonb_typeof(v_user_ans->'image1') <> 'null' AND jsonb_typeof(v_user_ans->'image2') <> 'null' THEN
            v_normalized_user_ans := jsonb_build_array(v_user_ans->'image1', v_user_ans->'image2');
          END IF;
        -- Numerical Series string vs number
        ELSIF jsonb_typeof(v_user_ans) = 'string' AND jsonb_typeof(v_correct_answer) = 'number' THEN
          IF trim(both '"' from v_user_ans::text) = v_correct_answer::text THEN
            v_normalized_user_ans := v_correct_answer;
          END IF;
        END IF;

        IF v_correct_answer IS NOT NULL AND v_normalized_user_ans = v_correct_answer THEN
          IF NOT v_ans_is_correct THEN
            v_changed := true;
          END IF;
          v_ans_is_correct := true;
        END IF;
      END IF;

      IF v_ans_is_correct THEN
        v_new_score := v_new_score + 1;
      END IF;

      v_new_answers := v_new_answers || jsonb_build_object(
        'question_id', ans.question_id,
        'user_answer', ans.user_answer,
        'is_correct', v_ans_is_correct,
        'is_answered', ans.is_answered
      );
    END LOOP;

    IF v_changed THEN
      UPDATE public.user_exams
      SET total_score = v_new_score,
          detailed_results = jsonb_set(r.detailed_results, '{answers}', v_new_answers)
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
