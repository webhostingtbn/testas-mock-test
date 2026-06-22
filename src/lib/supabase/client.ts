'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl } from '@/lib/supabase/url';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      getSupabaseUrl() || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key',
      {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
        },
      }
    );
  }

  if (!client) {
    client = createBrowserClient(
      getSupabaseUrl() || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key',
      {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
        },
      }
    );
  }

  return client;
}
