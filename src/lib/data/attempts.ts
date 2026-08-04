import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireApprovedUser } from '@/lib/auth/guards';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { CompletionReason } from '@/lib/types';
import { buildAttemptSectionScores } from '@/lib/exam/attempt-results';

type SectionRow = Database['public']['Tables']['sections']['Row'];
type QuestionReference = Pick<Database['public']['Tables']['questions']['Row'], 'id' | 'section_id'>;

function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }
  if (typeof value === 'object') {
    const objectValue: { [key: string]: Json | undefined } = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) objectValue[key] = toJson(item);
    });
    return objectValue;
  }
  return String(value);
}

export async function createAttempt(examId: string) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  let examQuery = supabase
    .from('exams')
    .select('id, is_active, format, retry_number')
    .eq('id', examId);
  if (profile.role !== 'admin') {
    examQuery = examQuery.eq('is_active', true);
    if (profile.format) examQuery = examQuery.eq('format', profile.format);
  }

  const { data: exam, error: examErr } = await examQuery.single();
  if (examErr || !exam) throw new Error('EXAM_NOT_AVAILABLE');

  const attemptLimit = profile.role === 'admin'
    ? null
    : (exam.retry_number ?? profile.allow_test_limit ?? 1);

  const { data, error } = await supabase.rpc('create_attempt_transaction', {
    p_exam_id: examId,
    p_user_id: profile.id,
    p_attempt_limit: attemptLimit,
  });

  if (error) {
    if (error.message.includes('TEST_LIMIT_EXCEEDED')) {
      throw new Error('TEST_LIMIT_EXCEEDED');
    }
    if (error.message.includes('EXAM_NOT_AVAILABLE')) {
      throw new Error('EXAM_NOT_AVAILABLE');
    }
    throw new Error(`Failed to create attempt: ${error.message}`);
  }
  return data;
}

export async function getAttempt(attemptId: string) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  const { data: attempt, error } = await supabase
    .from('user_exams')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (error || !attempt) throw new Error('ATTEMPT_NOT_FOUND');

  // Verify ownership (unless admin)
  if (attempt.user_id !== profile.id && profile.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }

  return attempt;
}

export async function listAttempts() {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from('user_exams')
    .select('id, user_id, exam_id, status, completion_reason, answered_count, started_at, completed_at, total_score, max_score, created_at, detailed_results')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch attempts: ${error.message}`);

  const attempts = data ?? [];
  const examIds = [...new Set(attempts.map((attempt) => attempt.exam_id))];
  if (examIds.length === 0) return [];

  const { data: exams, error: examError } = await supabase
    .from('exams')
    .select('id, format')
    .in('id', examIds);
  if (examError) throw new Error(`Failed to fetch attempt exams: ${examError.message}`);

  const { data: sections, error: sectionError } = await supabase
    .from('sections')
    .select('*')
    .in('exam_id', examIds);
  if (sectionError) throw new Error(`Failed to fetch attempt sections: ${sectionError.message}`);

  const sectionRows: SectionRow[] = sections ?? [];
  const sectionIds = sectionRows.map((section) => section.id);
  let questionRows: QuestionReference[] = [];

  if (sectionIds.length > 0) {
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, section_id')
      .in('section_id', sectionIds);
    if (questionError) throw new Error(`Failed to fetch attempt questions: ${questionError.message}`);
    questionRows = questions ?? [];
  }

  const examFormats = new Map((exams ?? []).map((exam) => [exam.id, exam.format]));
  const sectionsById = new Map(sectionRows.map((section) => [section.id, section]));
  const questionSectionIds = new Map(questionRows.map((question) => [question.id, question.section_id]));

  return attempts.map((attempt) => ({
    ...attempt,
    exam_format: examFormats.get(attempt.exam_id) ?? null,
    section_scores: buildAttemptSectionScores(attempt.detailed_results, questionSectionIds, sectionsById),
  }));
}

export async function updateAttemptProgress(attemptId: string, userAnswers: Record<string, unknown>) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  // Verify ownership
  const attempt = await getAttempt(attemptId);
  if (attempt.user_id !== profile.id) {
    throw new Error('FORBIDDEN');
  }

  if (attempt.status === 'completed') {
    throw new Error('ATTEMPT_ALREADY_COMPLETED');
  }

  const { data, error } = await supabase
    .from('user_exams')
    .update({
      user_answers: toJson(userAnswers),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update progress: ${error.message}`);
  return data;
}

export async function submitAttempt(
  attemptId: string,
  userAnswers: Record<string, unknown>,
  completionReason: CompletionReason = 'finished',
) {
  const { profile } = await requireApprovedUser();
  const supabase = getAdminSupabaseClient();

  const { data, error } = await supabase.rpc('submit_attempt_transaction_v2', {
    p_attempt_id: attemptId,
    p_user_id: profile.id,
    p_user_answers: toJson(userAnswers),
    p_completion_reason: completionReason,
  });

  if (error) {
    throw new Error(`Scoring failed: ${error.message}`);
  }

  return data;
}
