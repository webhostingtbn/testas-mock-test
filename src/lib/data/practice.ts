import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireApprovedUser } from '@/lib/auth/guards';

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
    return { sections: [], questions: [], userPractices: [] };
  }

  const { data: sections, error: sectionErr } = await supabase
    .from('sections')
    .select('id, exam_id, title, description, question_type, duration_seconds, question_count, sort_order, environment_content, created_at')
    .in('exam_id', examIds)
    .order('sort_order', { ascending: true });

  if (sectionErr) throw new Error(`Failed to fetch practice sections: ${sectionErr.message}`);

  const sectionIds = (sections ?? []).map((section) => section.id);
  const { data: questions, error: qErr } = sectionIds.length > 0
    ? await supabase
    .from('questions')
    .select('id, section_id, sort_order, question_type, content, passage_id, created_at')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (qErr) throw new Error(`Failed to fetch practice questions: ${qErr.message}`);

  const { data: userPractices, error: pErr } = await supabase
    .from('user_question_practices')
    .select('*')
    .eq('user_id', profile.id);

  if (pErr) throw new Error(`Failed to fetch practice ratings: ${pErr.message}`);

  return {
    sections: sections || [],
    questions: questions || [],
    userPractices: userPractices || [],
  };
}

export async function updatePracticeRating(questionId: string, difficulty: 'easy' | 'medium' | 'hard') {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('id, section_id')
    .eq('id', questionId)
    .maybeSingle();
  if (questionError || !question) throw new Error('QUESTION_NOT_AVAILABLE');

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('exam_id')
    .eq('id', question.section_id)
    .maybeSingle();
  if (sectionError || !section) throw new Error('QUESTION_NOT_AVAILABLE');

  let examQuery = supabase
    .from('exams')
    .select('id')
    .eq('id', section.exam_id)
    .eq('is_active', true);
  if (profile.format) examQuery = examQuery.eq('format', profile.format);
  const { data: exam, error: examError } = await examQuery.maybeSingle();
  if (examError || !exam) throw new Error('QUESTION_NOT_AVAILABLE');

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
