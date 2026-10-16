import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchMyProfile, updateMyProfile, updatePreferredLanguage } from '@/lib/data/profiles';
import { isLang, LANG_COOKIE } from '@/lib/i18n/config';
import { setLangCookie } from '@/lib/i18n/server';

export async function GET() {
  try {
    const profile = await fetchMyProfile();
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get(LANG_COOKIE)?.value;

    if (!profile.preferred_language && cookieLang && isLang(cookieLang)) {
      await updatePreferredLanguage(profile.id, cookieLang);
      profile.preferred_language = cookieLang;
    }

    const response = NextResponse.json({ profile });

    if (profile.preferred_language && isLang(profile.preferred_language)) {
      if (cookieLang !== profile.preferred_language) {
        setLangCookie(response, profile.preferred_language);
      }
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }
    if (message === 'PROFILE_LOOKUP_FAILED') {
      return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const profile = await updateMyProfile(body);
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }
    if (message === 'PROFILE_LOOKUP_FAILED') {
      return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
    }
    if (message === 'INVALID_PROFILE_FIELD' || message === 'INVALID_PROFILE_UPDATE') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
