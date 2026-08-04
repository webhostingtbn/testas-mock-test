import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireApprovedUser } from '@/lib/auth/guards';

export async function fetchExams() {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  let query = supabase
    .from('exams')
    .select('id, title, description, major, created_at, retry_number, format, is_active')
    .order('created_at', { ascending: false });

  if (profile.role !== 'admin') {
    query = query.eq('is_active', true);
    if (profile.format) {
      query = query.ilike('format', profile.format);
    }
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch exams: ${error.message}`);
  return data || [];
}

export async function fetchExamById(examId: string) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

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
    .select('id, exam_id, title, description, question_type, duration_seconds, question_count, sort_order, environment_content, created_at')
    .eq('exam_id', examId)
    .order('sort_order', { ascending: true });

  if (sectionErr) throw new Error(`Failed to fetch sections: ${sectionErr.message}`);

  const sectionIds = (sections ?? []).map((section) => section.id);

  const { data: passages, error: passErr } = sectionIds.length > 0
    ? await supabase
    .from('passages')
    .select('id, section_id, title, body_markdown, image_url, sort_order')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (passErr) throw new Error(`Failed to fetch passages: ${passErr.message}`);

  const { data: questions, error: qErr } = sectionIds.length > 0
    ? await supabase
    .from('questions')
    .select('id, section_id, sort_order, question_type, content, passage_id, created_at')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true })
    : { data: [], error: null };

  if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);

  return {
    exam,
    sections: sections || [],
    passages: passages || [],
    questions: questions || [],
  };
}
