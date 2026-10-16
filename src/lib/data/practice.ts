import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireApprovedUser } from '@/lib/auth/guards';
import { localizeExamData } from '@/lib/i18n/localize';
import { resolveRequestLang } from '@/lib/i18n/server';
import { getDeGaps } from '@/lib/data/exams';
import { enrichPracticeQuestions } from '@/lib/exam/practice-helpers';
import type { Lang } from '@/lib/i18n/config';

const GERMAN_AND_ENGLISH: Lang[] = ['en', 'de'];
const ENGLISH_ONLY: Lang[] = ['en'];

export async function fetchPracticeData() {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  let examQuery = supabase
    .from('exams')
    .select('id')
    .eq('is_active', true);

  if (profile.format) {
    examQuery = examQuery.eq('format', profile.format);
  }

  const { data: exams, error: examErr } = await examQuery;
  if (examErr) throw new Error(`Failed to fetch practice exams: ${examErr.message}`);

  const examIds = (exams ?? []).map((exam) => exam.id);
  if (examIds.length === 0) {
    const lang = await resolveRequestLang(profile);
    return { sections: [], questions: [], userPractices: [], passages: [], lang };
  }

  const { data: sections, error: sectionErr } = await supabase
    .from('sections')
    .select('id, exam_id, title, description, question_type, duration_seconds, question_count, sort_order, environment_content, translations, created_at')
    .in('exam_id', examIds)
    .order('sort_order', { ascending: true });

  if (sectionErr) throw new Error(`Failed to fetch practice sections: ${sectionErr.message}`);

  const sectionIds = (sections ?? []).map((section) => section.id);
  const { data: questions, error: qErr } = sectionIds.length > 0
    ? await supabase
    .from('questions')
    .select('id, section_id, sort_order, question_type, content, translations, passage_id, created_at')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: null, error: null };

  if (qErr) throw new Error(`Failed to fetch practice questions: ${qErr.message}`);

  const { data: passages, error: passErr } = sectionIds.length > 0
    ? await supabase
    .from('passages')
    .select('id, section_id, title, body_markdown, image_url, translations')
    .in('section_id', sectionIds)
    : { data: null, error: null };

  if (passErr) throw new Error(`Failed to fetch practice passages: ${passErr.message}`);

  const { data: userPractices, error: pErr } = await supabase
    .from('user_question_practices')
    .select('*')
    .eq('user_id', profile.id);

  if (pErr) throw new Error(`Failed to fetch practice ratings: ${pErr.message}`);

  const lang = await resolveRequestLang(profile);

  const localized = localizeExamData(
    {
      sections: sections || [],
      passages: passages || [],
      questions: questions || [],
    },
    lang,
  );

  const localizedPassages = localized.passages;
  const enrichedQuestions = enrichPracticeQuestions(localized.questions, localizedPassages);

  const gapsBySection = await getDeGaps(sectionIds);

  const sectionsWithLanguages = localized.sections.map((sec) => ({
    ...sec,
    languages: gapsBySection.get(sec.id) === 0 ? GERMAN_AND_ENGLISH : ENGLISH_ONLY,
  }));

  return {
    sections: sectionsWithLanguages,
    questions: enrichedQuestions,
    passages: localizedPassages,
    userPractices: userPractices || [],
    lang,
  };
}

/** Lightweight ratings-only fetch for background reconciliation (no sections/questions). */
export async function fetchPracticeRatings() {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  const { data: userPractices, error: pErr } = await supabase
    .from('user_question_practices')
    .select('*')
    .eq('user_id', profile.id);

  if (pErr) throw new Error(`Failed to fetch practice ratings: ${pErr.message}`);

  return { userPractices: userPractices || [] };
}

export async function updatePracticeRating(questionId: string, difficulty: 'easy' | 'medium' | 'hard') {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('id, section_id')
    .eq('id', questionId)
    .maybeSingle();

  if (questionError) {
    throw new Error(`Failed to verify question: ${questionError.message}`);
  }
  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('exam_id')
    .eq('id', question.section_id)
    .maybeSingle();
  if (sectionError) throw new Error(`Failed to verify question section: ${sectionError.message}`);
  if (!section) throw new Error('QUESTION_NOT_FOUND');

  let examQuery = supabase
    .from('exams')
    .select('id')
    .eq('id', section.exam_id)
    .eq('is_active', true);
  if (profile.role !== 'admin' && profile.format) {
    examQuery = examQuery.eq('format', profile.format);
  }

  const { data: exam, error: examError } = await examQuery.maybeSingle();
  if (examError) throw new Error(`Failed to verify question exam: ${examError.message}`);
  if (!exam) throw new Error('FORBIDDEN');

  const { data, error } = await supabase
    .from('user_question_practices')
    .upsert(
      {
        user_id: profile.id,
        question_id: questionId,
        difficulty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to update practice rating: ${error.message}`);
  return data;
}
