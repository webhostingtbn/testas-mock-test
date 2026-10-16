-- 1. translations columns
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.passages  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sections  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_translations_shape;
ALTER TABLE public.questions ADD CONSTRAINT questions_translations_shape
  CHECK (jsonb_typeof(translations) = 'object' AND (translations - 'de') = '{}'::jsonb);
ALTER TABLE public.passages DROP CONSTRAINT IF EXISTS passages_translations_shape;
ALTER TABLE public.passages ADD CONSTRAINT passages_translations_shape
  CHECK (jsonb_typeof(translations) = 'object' AND (translations - 'de') = '{}'::jsonb);
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_translations_shape;
ALTER TABLE public.sections ADD CONSTRAINT sections_translations_shape
  CHECK (jsonb_typeof(translations) = 'object' AND (translations - 'de') = '{}'::jsonb);

-- 2. user preference (NULL = never chosen)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_preferred_language;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_preferred_language
  CHECK (preferred_language IN ('en','de'));

-- 3. attempt language lock
ALTER TABLE public.user_exams ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.user_exams DROP CONSTRAINT IF EXISTS chk_user_exams_language;
ALTER TABLE public.user_exams ADD CONSTRAINT chk_user_exams_language
  CHECK (language IN ('en','de'));

-- 4. indexes + coverage view
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON public.questions(section_id);
CREATE INDEX IF NOT EXISTS idx_passages_section_id  ON public.passages(section_id);

CREATE OR REPLACE VIEW public.section_de_gaps
WITH (security_invoker = true) AS
SELECT s.id AS section_id, s.exam_id,
  ( (CASE WHEN btrim(coalesce(s.translations #>> '{de,title}', '')) = ''
           OR (btrim(coalesce(s.description,'')) <> '' AND btrim(coalesce(s.translations #>> '{de,description}', '')) = '')
           OR (btrim(coalesce(s.environment_content->>'text','')) <> '' AND btrim(coalesce(s.translations #>> '{de,environment_content,text}', '')) = '')
         THEN 1 ELSE 0 END)
  + (SELECT count(*) FROM public.questions q
      WHERE q.section_id = s.id
        AND btrim(coalesce(q.content->>'question_text','')) <> ''
        AND btrim(coalesce(q.translations #>> '{de,question_text}', '')) = '')
  + (SELECT count(*) FROM public.passages p
      WHERE p.section_id = s.id
        AND ( btrim(coalesce(p.translations #>> '{de,title}', '')) = ''
           OR (btrim(coalesce(p.body_markdown,'')) <> '' AND btrim(coalesce(p.translations #>> '{de,body_markdown}', '')) = '') ))
  )::int AS missing_de
FROM public.sections s;

REVOKE ALL ON public.section_de_gaps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.section_de_gaps TO service_role;