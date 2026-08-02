import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export async function adminFetchAllUsers() {
  await requireAdmin();
  const supabase = getAdminSupabaseClient();

  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);

  const { data: attempts, error: attemptsError } = await supabase
    .from('user_exams')
    .select('id, user_id, exam_id, status, started_at, completed_at, total_score, max_score, created_at, detailed_results')
    .order('created_at', { ascending: false });

  if (attemptsError) throw new Error(`Failed to fetch user attempts: ${attemptsError.message}`);

  const attemptsByUser = new Map<string, typeof attempts>();
  (attempts ?? []).forEach((attempt) => {
    const userAttempts = attemptsByUser.get(attempt.user_id) ?? [];
    userAttempts.push(attempt);
    attemptsByUser.set(attempt.user_id, userAttempts);
  });

  return (users ?? []).map((user) => ({
    ...user,
    user_exams: attemptsByUser.get(user.id) ?? [],
  }));
}

export async function adminUpdateUserLimit(userId: string, limit: number) {
  await requireAdmin();
  const supabase = getAdminSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({ allow_test_limit: limit })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user limit: ${error.message}`);
  return data;
}

export async function adminSetAllUsersLimit(limit: number) {
  await requireAdmin();
  const supabase = getAdminSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({ allow_test_limit: limit })
    .neq('role', 'admin')
    .select();

  if (error) throw new Error(`Failed to set bulk user limit: ${error.message}`);
  return data;
}

export async function adminToggleExamActive(examId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = getAdminSupabaseClient();

  const { data, error } = await supabase
    .from('exams')
    .update({ is_active: isActive })
    .eq('id', examId)
    .select()
    .single();

  if (error) throw new Error(`Failed to toggle exam active status: ${error.message}`);
  return data;
}
