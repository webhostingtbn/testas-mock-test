-- Migration: Add completion_reason, answered_count columns and v2 scoring RPC
-- This migration coexists with the v1 submit_attempt_transaction function.

-- 1. Add new columns with constraints
ALTER TABLE public.user_exams
  ADD COLUMN IF NOT EXISTS completion_reason TEXT NOT NULL DEFAULT 'finished',
  ADD COLUMN IF NOT EXISTS answered_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_exams
  DROP CONSTRAINT IF EXISTS check_completion_reason,
  ADD CONSTRAINT check_completion_reason CHECK (completion_reason IN ('finished', 'ended_early'));

-- 2. Backfill existing completed attempts.
-- Count only non-null submitted answers that belong to the attempt's exam and
-- have a scoreable answer-key row. This matches the legacy v1 denominator.
UPDATE public.user_exams AS attempt
SET completion_reason = 'finished',
    answered_count = LEAST(
      COALESCE(attempt.max_score, 0),
      COALESCE((
        SELECT count(*)::INTEGER
        FROM jsonb_each(
          CASE
            WHEN jsonb_typeof(attempt.user_answers) = 'object' THEN attempt.user_answers
            ELSE '{}'::JSONB
          END
        ) AS submitted(question_id, answer_value)
        JOIN public.questions AS question
          ON question.id::TEXT = submitted.question_id
        JOIN public.sections AS section
          ON section.id = question.section_id
         AND section.exam_id = attempt.exam_id
        JOIN private.question_answers AS answer_key
          ON answer_key.question_id = question.id
        WHERE jsonb_typeof(submitted.answer_value) <> 'null'
      ), 0)
    )
WHERE attempt.status = 'completed';

ALTER TABLE public.user_exams
  DROP CONSTRAINT IF EXISTS check_answered_count_nonnegative,
  ADD CONSTRAINT check_answered_count_nonnegative CHECK (answered_count >= 0);

ALTER TABLE public.user_exams
  DROP CONSTRAINT IF EXISTS check_answered_count_bounded,
  ADD CONSTRAINT check_answered_count_bounded
    CHECK (max_score IS NULL OR answered_count <= max_score);

-- 3. Create private v2 scoring function
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
    SELECT q.id, qa.correct_answer
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

    v_is_correct := (v_is_answered AND v_correct_json IS NOT NULL AND v_user_ans_json = v_correct_json);
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

-- 4. Create public wrapper
CREATE OR REPLACE FUNCTION public.submit_attempt_transaction_v2(
  p_attempt_id UUID,
  p_user_id UUID,
  p_user_answers JSONB,
  p_completion_reason TEXT DEFAULT 'finished'
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.submit_attempt_transaction_v2(p_attempt_id, p_user_id, p_user_answers, p_completion_reason);
$$;

REVOKE EXECUTE ON FUNCTION public.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) TO service_role, postgres;
