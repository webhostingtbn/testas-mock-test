const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export function getSupabaseUrl() {
  const proxyUrl = process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL?.trim();
  if (proxyUrl) return trimTrailingSlash(proxyUrl);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return `${trimTrailingSlash(appUrl)}/supabase`;

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/supabase`;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}
