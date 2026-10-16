import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth/guards';
import { isLang } from '@/lib/i18n/config';
import { updatePreferredLanguage } from '@/lib/data/profiles';
import { setLangCookie } from '@/lib/i18n/server';

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const lang = body?.lang;

    if (!isLang(lang)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    const profile = await getCurrentProfile();
    if (profile?.id) {
      await updatePreferredLanguage(profile.id, lang);
    }

    const response = NextResponse.json({ ok: true, lang });
    setLangCookie(response, lang);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
