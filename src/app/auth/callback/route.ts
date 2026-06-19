import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/select-module';

  // Prevent open redirects
  const safeNext = next.startsWith('/') ? next : '/select-module';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin;

  if (code) {
    const supabase = await createClient();
    const result = await supabase.auth.exchangeCodeForSession(code);
    const { error } = result;
    if (!error) {
      // Check if user has selected a major
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('module_test')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.module_test) {
          // Redirect to select module before dashboard
          return NextResponse.redirect(`${baseUrl}/select-module`);
        }
      }
      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    }
    // Debug: if exchange failed, include the error message in the redirect so it is visible in the browser
    try {
      const encoded = encodeURIComponent(error?.message || JSON.stringify(error));
      return NextResponse.redirect(`${baseUrl}/login?error=auth&detail=${encoded}`);
    } catch (e) {
      // Fallback to a simple redirect if encoding fails
      return NextResponse.redirect(`${baseUrl}/login?error=auth`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${baseUrl}/login?error=auth`);
}
