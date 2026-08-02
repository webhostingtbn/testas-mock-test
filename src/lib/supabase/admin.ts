import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/supabase/url';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

let adminClient: SupabaseClient<Database> | null = null;

function getServerSupabaseKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('[Supabase Admin] Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)');
  }

  if (key.startsWith('sb_publishable_')) {
    throw new Error('[Supabase Admin] A publishable key was configured as the server key. Use an sb_secret_ key or legacy service_role key.');
  }

  return key;
}

export function getAdminSupabaseClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const url = getSupabaseUrl() || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = getServerSupabaseKey();

  if (!url) {
    throw new Error('[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  adminClient = createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
