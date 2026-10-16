import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { DEFAULT_LANG, LANG_COOKIE, isLang, type Lang } from './config';
import { translate, type MessageKey } from './messages';
import type { UserProfile } from '@/lib/auth/guards';

export const LANG_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
};

export function setLangCookie(response: NextResponse, lang: Lang): void {
  response.cookies.set(LANG_COOKIE, lang, LANG_COOKIE_OPTIONS);
}

export async function resolveRequestLang(
  profile?: Pick<UserProfile, 'preferred_language'> | null,
): Promise<Lang> {
  if (profile?.preferred_language && isLang(profile.preferred_language)) {
    return profile.preferred_language;
  }

  try {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
    if (cookieLang && isLang(cookieLang)) {
      return cookieLang;
    }
  } catch {
    // Handled safely in non-request environments
  }

  return DEFAULT_LANG;
}

export async function getT(
  lang?: Lang,
): Promise<(key: MessageKey, vars?: Record<string, string | number>) => string> {
  const resolved = lang ?? (await resolveRequestLang());
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(resolved, key, vars);
}

