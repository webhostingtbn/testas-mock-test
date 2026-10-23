-- Migration: 20261023120000_fix_paper_scoring_and_depiction_paths.sql
-- Description: Fixes multi-module mock scoring, depiction image storage paths, and Paper 3 section counts.

-- 1. Allow mock attempts to store candidate-scoped section_ids
ALTER TABLE public.user_exams
DROP CONSTRAINT IF EXISTS chk_user_exams_attempt_kind_sections;

ALTER TABLE public.user_exams
ADD CONSTRAINT chk_user_exams_attempt_kind_sections
CHECK (
  (attempt_kind = 'mock') OR
  (attempt_kind = 'drill' AND section_ids IS NOT NULL AND cardinality(section_ids) > 0)
);

-- 2. Update private.submit_attempt_transaction_v2 to scope scoring to v_attempt.section_ids when present
CREATE OR REPLACE FUNCTION private.submit_attempt_transaction_v2(
  p_attempt_id uuid,
  p_user_id uuid,
  p_user_answers jsonb,
  p_completion_reason text DEFAULT 'finished'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
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

  SELECT * INTO v_attempt
  FROM public.user_exams
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or user unauthorized' USING ERRCODE = 'P0002';
  END IF;

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

  IF EXISTS (
    SELECT 1
    FROM public.questions AS question
    JOIN public.sections AS section ON section.id = question.section_id
    LEFT JOIN private.question_answers AS answer_key ON answer_key.question_id = question.id
    WHERE section.exam_id = v_attempt.exam_id
      AND (v_attempt.section_ids IS NULL OR section.id = ANY(v_attempt.section_ids))
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
      AND (v_attempt.section_ids IS NULL OR s.id = ANY(v_attempt.section_ids))
  LOOP
    v_total := v_total + 1;
    v_correct_json := v_question.correct_answer;
    v_user_ans_json := p_user_answers -> v_question.id::text;

    v_is_answered := (
      p_user_answers ? v_question.id::TEXT
      AND jsonb_typeof(v_user_ans_json) <> 'null'
    );
    IF v_is_answered THEN
      v_answered_count := v_answered_count + 1;
    END IF;

    v_user_ans_normalized := v_user_ans_json;
    IF v_is_answered THEN
      IF jsonb_typeof(v_user_ans_json) = 'object' 
         AND v_user_ans_json ? 'image1' 
         AND v_user_ans_json ? 'image2' THEN
        IF v_user_ans_json->'image1' IS NOT NULL 
           AND v_user_ans_json->'image2' IS NOT NULL 
           AND jsonb_typeof(v_user_ans_json->'image1') <> 'null' 
           AND jsonb_typeof(v_user_ans_json->'image2') <> 'null' THEN
          v_user_ans_normalized := jsonb_build_array(v_user_ans_json->'image1', v_user_ans_json->'image2');
        END IF;
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

  IF v_total = 0 THEN
    RAISE EXCEPTION 'NO_QUESTIONS_FOUND_FOR_ATTEMPT' USING ERRCODE = 'P0010';
  END IF;

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
$function$;

-- 3. Normalize depiction storage folder and extension in passages and questions
UPDATE passages 
SET image_url = regexp_replace(image_url, '/depiction/([^/]+)\.(png|jpeg|webp)', '/depictions/\1.webp') 
WHERE image_url LIKE '%/depiction/%';

UPDATE questions 
SET content = regexp_replace(content::text, '/depiction/([^/]+)\.(png|jpeg|webp)', '/depictions/\1.webp', 'g')::jsonb 
WHERE content::text LIKE '%/depiction/%';

-- 4. Correct declared question count for eng_2_3d sections (13 questions, not 65)
UPDATE sections 
SET question_count = 13 
WHERE question_type = 'eng_2_3d' AND question_count = 65;
