-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  module_test USER-DEFINED,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text])),
  phonenumber text UNIQUE,
  allow_test_limit integer NOT NULL DEFAULT 1,
  status USER-DEFINED NOT NULL DEFAULT 'Pending'::profile_status,
  format USER-DEFINED NOT NULL DEFAULT 'Unassign'::profile_format,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  major USER-DEFINED,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  retry_number smallint,
  format text NOT NULL DEFAULT 'Digital'::text CHECK (format = ANY (ARRAY['Digital'::text, 'Paper'::text])),
  CONSTRAINT exams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  question_type USER-DEFINED NOT NULL,
  duration_seconds integer NOT NULL,
  question_count integer NOT NULL DEFAULT 20,
  sort_order integer NOT NULL DEFAULT 0,
  environment_content jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sections_pkey PRIMARY KEY (id),
  CONSTRAINT sections_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  question_type USER-DEFINED NOT NULL,
  content jsonb NOT NULL,
  correct_answer jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  passage_id uuid,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id),
  CONSTRAINT questions_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES public.passages(id)
);
CREATE TABLE public.user_exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'not_started'::exam_status,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  total_score integer,
  max_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  detailed_results jsonb,
  CONSTRAINT user_exams_pkey PRIMARY KEY (id),
  CONSTRAINT user_exams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_exams_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.user_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_exam_id uuid NOT NULL,
  section_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'not_started'::section_status,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  score integer,
  max_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_sections_pkey PRIMARY KEY (id),
  CONSTRAINT user_sections_user_exam_id_fkey FOREIGN KEY (user_exam_id) REFERENCES public.user_exams(id),
  CONSTRAINT user_sections_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.user_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_section_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer jsonb,
  is_correct boolean,
  answered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_responses_pkey PRIMARY KEY (id),
  CONSTRAINT user_responses_user_section_id_fkey FOREIGN KEY (user_section_id) REFERENCES public.user_sections(id),
  CONSTRAINT user_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid,
  title text NOT NULL,
  body_markdown text NOT NULL,
  image_url text,
  sort_order integer DEFAULT 0,
  CONSTRAINT passages_pkey PRIMARY KEY (id),
  CONSTRAINT passages_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.user_question_practices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  difficulty text NOT NULL CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_question_practices_pkey PRIMARY KEY (id),
  CONSTRAINT user_question_practices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_question_practices_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);