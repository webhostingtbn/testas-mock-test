import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireApprovedUser } from '@/lib/auth/guards';
import { filterSections } from '@/lib/constants';
import { localizeExamData } from '@/lib/i18n/localize';
import { resolveRequestLang } from '@/lib/i18n/server';
import type { Lang } from '@/lib/i18n/config';
import type { ExamSectionSummary } from '@/lib/types';

const GERMAN_AND_ENGLISH: Lang[] = ['en', 'de'];
const ENGLISH_ONLY: Lang[] = ['en'];

export async function getDeGaps(sectionIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!sectionIds.length) return map;

  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from('section_de_gaps')
    .select('section_id, missing_de')
    .in('section_id', sectionIds);

  if (error) {
    console.error('Failed to query section_de_gaps view:', error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.section_id, row.missing_de ?? 0);
  }
  return map;
}

export async function germanAvailable(sectionIds: string[]): Promise<boolean> {
  if (!sectionIds.length) return false;
  const gaps = await getDeGaps(sectionIds);
  return gaps.size === sectionIds.length && Array.from(gaps.values()).every((m) => m === 0);
}

export async function fetchExams() {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  let query = supabase
    .from('exams')
    .select(`
      id, title, description, major, created_at, retry_number, format, is_active,
      sections (
        id, title, question_type, duration_seconds, question_count, sort_order
      )
    `)
    .order('created_at', { ascending: false });

  if (profile.role !== 'admin') {
    query = query.eq('is_active', true);
    if (profile.format) {
      query = query.ilike('format', profile.format);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch exams: ${error.message}`);

  const rawExams = data || [];
  const allSectionIds = rawExams.flatMap((e) =>
    Array.isArray(e.sections) ? e.sections.map((s) => s.id) : [],
  );
  const gapsBySection = await getDeGaps(allSectionIds);

  const exams = rawExams.map((exam) => {
    const sortedSections: ExamSectionSummary[] = Array.isArray(exam.sections)
      ? [...exam.sections]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => ({
            ...s,
            languages: gapsBySection.get(s.id) === 0 ? GERMAN_AND_ENGLISH : ENGLISH_ONLY,
          }))
      : [];

    const isPaper = exam.format?.toLowerCase() === 'paper';
    let applicableSections = sortedSections;
    if (profile.module_test) {
      const { coreSections, moduleSections } = filterSections(
        sortedSections,
        isPaper,
        profile.module_test,
      );
      const scoped = [...coreSections, ...moduleSections];
      if (scoped.length > 0) {
        applicableSections = scoped;
      }
    }

    const isGermanAvailable =
      applicableSections.length > 0 &&
      applicableSections.every((s) => gapsBySection.get(s.id) === 0);

    return {
      ...exam,
      languages: isGermanAvailable ? GERMAN_AND_ENGLISH : ENGLISH_ONLY,
      sections: sortedSections,
    };
  });

  return exams;
}

export async function fetchExamById(examId: string, opts?: { lang?: Lang }) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();
  const lang = opts?.lang ?? (await resolveRequestLang(profile));

  let examQuery = supabase
    .from('exams')
    .select('id, title, description, major, created_at, retry_number, format, is_active')
    .eq('id', examId);

  if (profile.role !== 'admin') {
    examQuery = examQuery.eq('is_active', true);
    if (profile.format) {
      examQuery = examQuery.eq('format', profile.format);
    }
  }

  const { data: exam, error: examErr } = await examQuery.single();

  if (examErr || !exam) throw new Error(`Exam not found: ${examErr?.message}`);

  const { data: sections, error: sectionErr } = await supabase
    .from('sections')
    .select('id, exam_id, title, description, question_type, duration_seconds, question_count, sort_order, environment_content, translations, created_at')
    .eq('exam_id', examId)
    .order('sort_order', { ascending: true });

  if (sectionErr) throw new Error(`Failed to fetch sections: ${sectionErr.message}`);

  const sectionIds = (sections ?? []).map((section) => section.id);

  const { data: passages, error: passErr } = sectionIds.length > 0
    ? await supabase
    .from('passages')
    .select('id, section_id, title, body_markdown, image_url, translations, sort_order')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: null, error: null };

  if (passErr) throw new Error(`Failed to fetch passages: ${passErr.message}`);

  const { data: questions, error: qErr } = sectionIds.length > 0
    ? await supabase
    .from('questions')
    .select('id, section_id, sort_order, question_type, content, translations, passage_id, created_at')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: null, error: null };

  if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);

  const localized = localizeExamData(
    {
      sections: sections || [],
      passages: passages || [],
      questions: questions || [],
    },
    lang,
  );

  return {
    exam,
    sections: localized.sections || [],
    passages: localized.passages || [],
    questions: localized.questions || [],
    lang,
  };
}
