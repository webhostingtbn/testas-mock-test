const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export function getSupabaseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_SUPABASE_URL);
  }

  return 'https://placeholder.supabase.co';
}
