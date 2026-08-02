import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

const PROFILE_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
const PROFILE_FORMATS = ['Digital', 'Paper'] as const;
const PROFILE_MODULES = ['natural_computer_science', 'economics', 'engineering'] as const;

type ProfileStatus = (typeof PROFILE_STATUSES)[number];
type ProfileFormat = (typeof PROFILE_FORMATS)[number];
type ProfileModule = (typeof PROFILE_MODULES)[number];

export interface AdminProfileUpdate {
  allow_test_limit?: number;
  status?: ProfileStatus;
  format?: ProfileFormat;
  module_test?: ProfileModule;
}

function isProfileStatus(value: unknown): value is ProfileStatus {
  return typeof value === 'string' && PROFILE_STATUSES.includes(value as ProfileStatus);
}

function isProfileFormat(value: unknown): value is ProfileFormat {
  return typeof value === 'string' && PROFILE_FORMATS.includes(value as ProfileFormat);
}

function isProfileModule(value: unknown): value is ProfileModule {
  return typeof value === 'string' && PROFILE_MODULES.includes(value as ProfileModule);
}

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
  return adminUpdateUserProfile(userId, { allow_test_limit: limit });
}

export async function adminUpdateUserProfile(userId: string, updates: unknown) {
  await requireAdmin();
  const supabase = getAdminSupabaseClient();

  if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
    throw new Error('INVALID_PROFILE_UPDATE');
  }

  const value = updates as Record<string, unknown>;
  const safeUpdates: AdminProfileUpdate = {};

  if (value.allow_test_limit !== undefined) {
    if (typeof value.allow_test_limit !== 'number' || !Number.isInteger(value.allow_test_limit) || value.allow_test_limit < 1) {
      throw new Error('INVALID_PROFILE_UPDATE');
    }
    safeUpdates.allow_test_limit = value.allow_test_limit;
  }
  if (value.status !== undefined) {
    if (!isProfileStatus(value.status)) throw new Error('INVALID_PROFILE_UPDATE');
    safeUpdates.status = value.status;
  }
  if (value.format !== undefined) {
    if (!isProfileFormat(value.format)) throw new Error('INVALID_PROFILE_UPDATE');
    safeUpdates.format = value.format;
  }
  if (value.module_test !== undefined) {
    if (!isProfileModule(value.module_test)) throw new Error('INVALID_PROFILE_UPDATE');
    safeUpdates.module_test = value.module_test;
  }

  if (Object.keys(safeUpdates).length === 0) throw new Error('INVALID_PROFILE_UPDATE');

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
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
