-- Migration: 20260924120000_add_subtest_drills_support.sql
-- Description: Adds Subtest Drills support (attempt_kind, section_ids, scoped scoring, quota isolation)

-- 1. Add columns to public.user_exams
ALTER TABLE public.user_exams 
ADD COLUMN IF NOT EXISTS attempt_kind TEXT NOT NULL DEFAULT 'mock' CHECK (attempt_kind IN ('mock', 'drill')),
ADD COLUMN IF NOT EXISTS section_ids UUID[] DEFAULT NULL;

-- 2. Enforce constraint: Mocks have NULL or empty section_ids; Drills must have non-empty section_ids
ALTER TABLE public.user_exams
DROP CONSTRAINT IF EXISTS chk_user_exams_attempt_kind_sections;

ALTER TABLE public.user_exams
ADD CONSTRAINT chk_user_exams_attempt_kind_sections
CHECK (
  (attempt_kind = 'mock' AND (section_ids IS NULL OR cardinality(section_ids) = 0)) OR
  (attempt_kind = 'drill' AND section_ids IS NOT NULL AND cardinality(section_ids) > 0)
);

-- 3. Indexes
-- A. Partial B-tree index for high-performance quota and mock attempts lookup
CREATE INDEX IF NOT EXISTS idx_user_exams_mock_attempts 
ON public.user_exams(user_id, exam_id) 
WHERE attempt_kind = 'mock';

-- B. B-tree index for user drill history queries
CREATE INDEX IF NOT EXISTS idx_user_exams_drill_attempts 
ON public.user_exams(user_id, created_at DESC) 
WHERE attempt_kind = 'drill';

-- 4. Drop legacy 3-parameter function overloads to prevent ambiguous resolution
DROP FUNCTION IF EXISTS public.create_attempt_transaction(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS private.create_attempt_transaction(UUID, UUID, INTEGER);

-- 5. Atomic PL/pgSQL RPC Function for Attempt Creation
CREATE OR REPLACE FUNCTION private.create_attempt_transaction(
  p_user_id UUID,
  p_exam_id UUID,
  p_attempt_limit INTEGER,
  p_section_ids UUID[] DEFAULT NULL,
  p_attempt_kind TEXT DEFAULT 'mock'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
DECLARE
  v_exam RECORD;
  v_attempt_count INTEGER;
  v_attempt RECORD;
BEGIN
  -- Input validation
  IF p_attempt_kind IS NULL OR p_attempt_kind NOT IN ('mock', 'drill') THEN
    RAISE EXCEPTION 'Invalid attempt kind: %', p_attempt_kind USING ERRCODE = 'P0005';
  END IF;

  SELECT id, is_active INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND OR v_exam.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'EXAM_NOT_AVAILABLE' USING ERRCODE = 'P0003';
  END IF;

  -- Drill validation & anti-bypass guards
  IF p_attempt_kind = 'drill' THEN
    IF p_section_ids IS NULL OR cardinality(p_section_ids) = 0 THEN
      RAISE EXCEPTION 'DRILL_MISSING_SECTIONS' USING ERRCODE = 'P0009';
    END IF;

    -- Enforce single-section drill start
    IF cardinality(p_section_ids) > 1 THEN
      RAISE EXCEPTION 'DRILL_SINGLE_SECTION_ONLY' USING ERRCODE = 'P0008';
    END IF;

    -- Verify that the requested section actually belongs to this exam
    IF NOT EXISTS (
      SELECT 1 FROM public.sections
      WHERE exam_id = p_exam_id AND id = ANY(p_section_ids)
    ) THEN
      RAISE EXCEPTION 'INVALID_SECTION_FOR_EXAM' USING ERRCODE = 'P0011';
    END IF;
  ELSE
    -- Mock Exam Quota Check
    IF p_attempt_limit IS NOT NULL THEN
      SELECT count(*) INTO v_attempt_count
      FROM public.user_exams
      WHERE user_id = p_user_id 
        AND exam_id = p_exam_id 
        AND attempt_kind = 'mock';

      IF v_attempt_count >= p_attempt_limit THEN
        RAISE EXCEPTION 'TEST_LIMIT_EXCEEDED' USING ERRCODE = 'P0004';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.user_exams (
    user_id, exam_id, attempt_kind, section_ids, status, started_at, user_answers, updated_at
  )
  VALUES (
    p_user_id, p_exam_id, p_attempt_kind, p_section_ids, 'in_progress', now(), '{}'::jsonb, now()
  )
  RETURNING id, user_id, exam_id, attempt_kind, section_ids, status, started_at, completed_at, total_score, max_score, created_at
  INTO v_attempt;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'exam_id', v_attempt.exam_id,
    'attempt_kind', v_attempt.attempt_kind,
    'section_ids', v_attempt.section_ids,
    'status', v_attempt.status,
    'started_at', v_attempt.started_at,
    'completed_at', v_attempt.completed_at,
    'total_score', v_attempt.total_score,
    'max_score', v_attempt.max_score,
    'created_at', v_attempt.created_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.create_attempt_transaction(UUID, UUID, INTEGER, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_attempt_transaction(UUID, UUID, INTEGER, UUID[], TEXT) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.create_attempt_transaction(
  p_user_id UUID,
  p_exam_id UUID,
  p_attempt_limit INTEGER,
  p_section_ids UUID[] DEFAULT NULL,
  p_attempt_kind TEXT DEFAULT 'mock'
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.create_attempt_transaction(p_user_id, p_exam_id, p_attempt_limit, p_section_ids, p_attempt_kind);
$$;

REVOKE EXECUTE ON FUNCTION public.create_attempt_transaction(UUID, UUID, INTEGER, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_attempt_transaction(UUID, UUID, INTEGER, UUID[], TEXT) TO service_role, postgres;

-- 6. Atomic PL/pgSQL RPC Function for Attempt Submission & Scoring v2
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

  -- Idempotency check: if already completed, return existing completed metrics
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

  -- Pre-scoring validation: ONLY check sections scoped to this attempt.
  -- Canonical safe predicate: (v_attempt.attempt_kind = 'mock' OR section.id = ANY(v_attempt.section_ids))
  IF EXISTS (
    SELECT 1
    FROM public.questions AS question
    JOIN public.sections AS section ON section.id = question.section_id
    LEFT JOIN private.question_answers AS answer_key ON answer_key.question_id = question.id
    WHERE section.exam_id = v_attempt.exam_id
      AND (v_attempt.attempt_kind = 'mock' OR section.id = ANY(v_attempt.section_ids))
      AND answer_key.question_id IS NULL
  ) THEN
    RAISE EXCEPTION 'ANSWER_KEY_MISSING' USING ERRCODE = 'P0007';
  END IF;

  -- Scoring loop: ONLY iterate over questions in this attempt
  FOR v_question IN
    SELECT q.id, q.question_type, qa.correct_answer
    FROM public.questions q
    JOIN public.sections s ON s.id = q.section_id
    JOIN private.question_answers qa ON qa.question_id = q.id
    WHERE s.exam_id = v_attempt.exam_id
      AND (v_attempt.attempt_kind = 'mock' OR s.id = ANY(v_attempt.section_ids))
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

    -- Answer normalization
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

  -- Guard against division by zero if an empty section slipped through
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
$$;

REVOKE EXECUTE ON FUNCTION private.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.submit_attempt_transaction_v2(UUID, UUID, JSONB, TEXT) TO service_role, postgres;

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
