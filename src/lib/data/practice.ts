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

  const { data: passages, error: passErr } = sectionIds.length > 0
    ? await supabase
    .from('passages')
    .select('id, section_id, title, body_markdown, image_url')
    .in('section_id', sectionIds)
    : { data: [], error: null };

  if (passErr) throw new Error(`Failed to fetch practice passages: ${passErr.message}`);

  const { data: userPractices, error: pErr } = await supabase
    .from('user_question_practices')
    .select('*')
    .eq('user_id', profile.id);

  if (pErr) throw new Error(`Failed to fetch practice ratings: ${pErr.message}`);

  const passageMap = new Map((passages ?? []).map((p) => [p.id, p]));

  const enrichedQuestions = (questions ?? []).map((q) => {
    const passage = q.passage_id ? passageMap.get(q.passage_id) : undefined;
    if (passage) {
      const contentObj = typeof q.content === 'object' && q.content !== null ? q.content : {};
      return {
        ...q,
        content: {
          ...contentObj,
          passage_title: passage.title,
          passage_markdown: passage.body_markdown,
          passage_image_url: passage.image_url,
        },
      };
    }
    return q;
  });

  return {
    sections: sections || [],
    questions: enrichedQuestions,
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
