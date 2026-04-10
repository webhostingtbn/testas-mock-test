import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/select-module';

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
          return NextResponse.redirect(`${origin}/select-module`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Debug: if exchange failed, include the error message in the redirect so it is visible in the browser
    try {
      const encoded = encodeURIComponent(error?.message || JSON.stringify(error));
      return NextResponse.redirect(`${origin}/login?error=auth&detail=${encoded}`);
    } catch (e) {
      // Fallback to a simple redirect if encoding fails
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
