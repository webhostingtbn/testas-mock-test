import 'server-only';

import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user' | string;
  status: string | null;
  allow_test_limit: number;
  format: string | null;
  module_test: string | null;
  phonenumber: string | null;
}

export async function requireUser(): Promise<{
  session: Session;
  profile: UserProfile;
}> {
  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    throw new Error('UNAUTHORIZED');
  }

  const supabase = getAdminSupabaseClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', session.user.email)
    .maybeSingle();

  if (error) {
    throw new Error('PROFILE_LOOKUP_FAILED');
  }

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return {
    session,
    profile: {
      ...profile,
      role: profile.role ?? 'user',
      allow_test_limit: profile.allow_test_limit ?? 1,
    },
  };
}

export async function requireAdmin(): Promise<{
  session: Session;
  profile: UserProfile;
}> {
  const { session, profile } = await requireUser();

  if (profile.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }

  return { session, profile };
}

export async function requireApprovedUser(): Promise<{
  session: Session;
  profile: UserProfile;
}> {
  const result = await requireUser();
  if (
    result.profile.role !== 'admin'
    && result.profile.status !== 'Approved'
    && result.profile.status !== 'Active'
  ) {
    throw new Error('FORBIDDEN');
  }
  return result;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const { profile } = await requireUser();
    return profile;
  } catch {
    return null;
  }
}
