-- Migration to add columns to profiles and exams, and create user_question_practices table

-- 1. Add columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phonenumber TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS allow_test_limit INTEGER NOT NULL DEFAULT 1;

-- 2. Add column to exams
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS retry_number SMALLINT;

-- 3. Create user_question_practices table
CREATE TABLE IF NOT EXISTS public.user_question_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- 4. Enable RLS and setup policies
ALTER TABLE public.user_question_practices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own practice ratings" ON public.user_question_practices;
CREATE POLICY "Users can manage own practice ratings"
  ON public.user_question_practices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_question_practices_user_id ON public.user_question_practices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_practices_question_id ON public.user_question_practices(question_id);
