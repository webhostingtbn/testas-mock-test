-- Phase 4 & 5: Private Schema, Answer Key Isolation, and Atomic PostgreSQL RPC Scoring

-- 1. Create unexposed private schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- Keep attempt answers private while preserving the existing user_exams score columns.
ALTER TABLE public.user_exams
  ADD COLUMN IF NOT EXISTS user_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Create private answer table with JSONB type
CREATE TABLE IF NOT EXISTS private.question_answers (
  question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_answer JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Backfill answers from public.questions if correct_answer column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'questions' 
      AND column_name = 'correct_answer'
  ) THEN
    INSERT INTO private.question_answers (question_id, correct_answer)
    SELECT id, correct_answer
    FROM public.questions
    WHERE correct_answer IS NOT NULL
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    ALTER TABLE public.questions DROP COLUMN IF EXISTS correct_answer;
  END IF;
END $$;

-- 4. Move any existing backup tables from public to private schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE '%backup%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA private;', r.tablename);
  END LOOP;
END $$;

-- 5. Atomic PL/pgSQL RPC Function for Attempt Submission & Scoring
CREATE OR REPLACE FUNCTION private.create_attempt_transaction(
  p_user_id UUID,
  p_exam_id UUID,
  p_attempt_limit INTEGER
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
  SELECT id, is_active INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND OR v_exam.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'EXAM_NOT_AVAILABLE' USING ERRCODE = 'P0003';
  END IF;

  IF p_attempt_limit IS NOT NULL THEN
    SELECT count(*) INTO v_attempt_count
    FROM public.user_exams
    WHERE user_id = p_user_id AND exam_id = p_exam_id;

    IF v_attempt_count >= p_attempt_limit THEN
      RAISE EXCEPTION 'TEST_LIMIT_EXCEEDED' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  INSERT INTO public.user_exams (user_id, exam_id, status, started_at, user_answers, updated_at)
  VALUES (p_user_id, p_exam_id, 'in_progress', now(), '{}'::jsonb, now())
  RETURNING id, user_id, exam_id, status, started_at, completed_at, total_score, max_score, created_at
  INTO v_attempt;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'exam_id', v_attempt.exam_id,
    'status', v_attempt.status,
    'started_at', v_attempt.started_at,
    'completed_at', v_attempt.completed_at,
    'total_score', v_attempt.total_score,
    'max_score', v_attempt.max_score,
    'created_at', v_attempt.created_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.create_attempt_transaction(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_attempt_transaction(UUID, UUID, INTEGER) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.create_attempt_transaction(
  p_user_id UUID,
  p_exam_id UUID,
  p_attempt_limit INTEGER
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.create_attempt_transaction(p_user_id, p_exam_id, p_attempt_limit);
$$;

REVOKE EXECUTE ON FUNCTION public.create_attempt_transaction(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_attempt_transaction(UUID, UUID, INTEGER) TO service_role, postgres;

-- 6. Atomic PL/pgSQL RPC Function for Attempt Submission & Scoring
CREATE OR REPLACE FUNCTION private.submit_attempt_transaction(
  p_attempt_id UUID,
  p_user_id TEXT,
  p_user_answers JSONB
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
  v_results JSONB := '[]'::jsonb;
  v_is_correct BOOLEAN;
BEGIN
  -- Lock attempt row for update to prevent concurrent race conditions or double submissions
  SELECT * INTO v_attempt
  FROM public.user_exams
  WHERE id = p_attempt_id AND (user_id::text = p_user_id OR user_id = p_user_id::uuid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or user unauthorized' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check: if attempt is already completed, return existing completed score
  IF v_attempt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'score', COALESCE(v_attempt.total_score, 0),
      'total', COALESCE(v_attempt.max_score, 0),
      'completed_at', v_attempt.completed_at
    );
  END IF;

  -- Iterate through exam questions and compare answers
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

    -- Evaluate correctness by direct JSONB comparison
    v_is_correct := (v_user_ans_json IS NOT NULL AND v_user_ans_json = v_correct_json);
    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    v_results := v_results || jsonb_build_object(
      'question_id', v_question.id,
      'user_answer', v_user_ans_json,
      'is_correct', v_is_correct
    );
  END LOOP;

  -- Atomically update attempt status and score
  UPDATE public.user_exams
  SET status = 'completed',
      total_score = v_score,
      max_score = v_total,
      detailed_results = jsonb_build_object('answers', v_results),
      user_answers = p_user_answers,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'score', v_score,
    'total', v_total,
    'results', v_results,
    'completed_at', now()
  );
END;
$$;

-- Revoke function execution from PUBLIC, anon, and authenticated roles
REVOKE EXECUTE ON FUNCTION private.submit_attempt_transaction(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Grant execution exclusively to service_role and postgres
GRANT EXECUTE ON FUNCTION private.submit_attempt_transaction(UUID, TEXT, JSONB) TO service_role, postgres;

-- PostgREST exposes public, not private, so provide a locked-down service-role wrapper.
CREATE OR REPLACE FUNCTION public.submit_attempt_transaction(
  p_attempt_id UUID,
  p_user_id TEXT,
  p_user_answers JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT private.submit_attempt_transaction(p_attempt_id, p_user_id, p_user_answers);
$$;

REVOKE EXECUTE ON FUNCTION public.submit_attempt_transaction(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attempt_transaction(UUID, TEXT, JSONB) TO service_role, postgres;
