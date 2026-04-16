-- =============================================================
-- TestAS Digital Mock Test — Supabase PostgreSQL Schema
-- =============================================================
-- Run this SQL in your Supabase SQL Editor to create all tables.
-- =============================================================

-- 1. ENUM TYPES
-- -------------------------------------------------------------
CREATE TYPE public.major_type AS ENUM (
  'economics',
  'engineering',
  'natural_computer_science'
);

CREATE TYPE public.question_type AS ENUM (
  'figure_sequence',
  'math_equation',
  'latin_square',
  'module_mcq'          -- Module-specific multiple choice (with environment/scheme)
);

CREATE TYPE public.exam_status AS ENUM (
  'not_started',
  'in_progress',
  'completed'
);

CREATE TYPE public.section_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'skipped'
);

-- 2. PROFILES (extends auth.users)
-- -------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  major major_type,
  role TEXT DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. EXAMS (exam definitions)
-- -------------------------------------------------------------
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  major major_type,             -- NULL = core test (all majors)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SECTIONS (subtests within an exam)
-- -------------------------------------------------------------
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  question_type question_type NOT NULL,
  duration_seconds INTEGER NOT NULL,       -- e.g., 1200 = 20 minutes
  question_count INTEGER NOT NULL DEFAULT 20,
  sort_order INTEGER NOT NULL DEFAULT 0,   -- Ordering within the exam
  -- For module_mcq: environment/scheme data
  environment_content JSONB,               -- { text: "...", images: ["url1", "url2"] }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. QUESTIONS
-- -------------------------------------------------------------
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question_type question_type NOT NULL,
  -- All question/answer data stored as flexible JSONB
  -- Figure Sequence: { sequence_images: [...], answer_options: [...] }
  -- Math Equation:   { equations: [...], variables: [...] }
  -- Latin Square:    { grid: [[...]], target_row: 2, target_col: 3 }
  -- Module MCQ:      { question_text: "...", question_image: "...", options: [...] }
  content JSONB NOT NULL,
  correct_answer JSONB NOT NULL,           -- The correct answer for auto-grading
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. USER EXAMS (a user's exam attempt)
-- -------------------------------------------------------------
CREATE TABLE public.user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  status exam_status NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_score INTEGER,
  max_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. USER SECTIONS (user's progress per section)
-- -------------------------------------------------------------
CREATE TABLE public.user_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_exam_id UUID NOT NULL REFERENCES public.user_exams(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  status section_status NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  max_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_exam_id, section_id)
);

-- 8. USER RESPONSES (individual answers)
-- -------------------------------------------------------------
CREATE TABLE public.user_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_section_id UUID NOT NULL REFERENCES public.user_sections(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB,                            -- User's answer (same shape as correct_answer)
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_section_id, question_id)
);

-- 9. INDEXES
-- -------------------------------------------------------------
CREATE INDEX idx_sections_exam_id ON public.sections(exam_id);
CREATE INDEX idx_questions_section_id ON public.questions(section_id);
CREATE INDEX idx_user_exams_user_id ON public.user_exams(user_id);
CREATE INDEX idx_user_sections_user_exam_id ON public.user_sections(user_exam_id);
CREATE INDEX idx_user_responses_user_section_id ON public.user_responses(user_section_id);

-- 10. ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_responses ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Exams, Sections, Questions: readable by all authenticated users
CREATE POLICY "Authenticated users can read exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read sections"
  ON public.sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- User Exams: users can CRUD their own
CREATE POLICY "Users can manage own exam attempts"
  ON public.user_exams FOR ALL
  USING (auth.uid() = user_id);

-- User Sections: users can manage their own (via user_exam ownership)
CREATE POLICY "Users can manage own sections"
  ON public.user_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_exams
      WHERE user_exams.id = user_sections.user_exam_id
      AND user_exams.user_id = auth.uid()
    )
  );

-- User Responses: users can manage their own
CREATE POLICY "Users can manage own responses"
  ON public.user_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sections
      JOIN public.user_exams ON user_exams.id = user_sections.user_exam_id
      WHERE user_sections.id = user_responses.user_section_id
      AND user_exams.user_id = auth.uid()
    )
  );
