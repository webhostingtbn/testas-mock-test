import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireUser, UserProfile } from '@/lib/auth/guards';

type EditableProfileField = 'full_name' | 'avatar_url' | 'module_test' | 'phonenumber' | 'format';
type EditableProfile = Partial<Record<EditableProfileField, string | null>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const { profile } = await requireUser();
  return profile;
}

export async function updateMyProfile(updates: unknown): Promise<UserProfile> {
  const { profile } = await requireUser();
  const supabase = getAdminSupabaseClient();

  if (!isRecord(updates)) {
    throw new Error('INVALID_PROFILE_UPDATE');
  }

  const editableFields: readonly EditableProfileField[] = [
    'full_name',
    'avatar_url',
    'module_test',
    'phonenumber',
    'format',
  ];
  const safeUpdates: EditableProfile = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!editableFields.includes(key as EditableProfileField)) {
      throw new Error('INVALID_PROFILE_FIELD');
    }
    if (value !== null && typeof value !== 'string') {
      throw new Error('INVALID_PROFILE_UPDATE');
    }
    safeUpdates[key as EditableProfileField] = value;
  }

  if (safeUpdates.format !== undefined && safeUpdates.format !== null && !['Digital', 'Paper'].includes(safeUpdates.format)) {
    throw new Error('INVALID_PROFILE_UPDATE');
  }

  if (Object.keys(safeUpdates).length === 0) return profile;

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return {
    ...data,
    role: data.role ?? 'user',
    allow_test_limit: data.allow_test_limit ?? 1,
  };
}
