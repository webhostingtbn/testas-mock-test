import type { Lang } from './config';

const LOCALE_MAP: Record<Lang, string> = {
  en: 'en-GB',
  de: 'de-DE',
};

export function getIntlLocale(lang: Lang): string {
  return LOCALE_MAP[lang] ?? 'en-GB';
}

export function formatDate(
  date: Date | string | number | null | undefined,
  lang: Lang,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const locale = getIntlLocale(lang);
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatNumber(
  n: number | null | undefined,
  lang: Lang,
  options?: Intl.NumberFormatOptions,
): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  const locale = getIntlLocale(lang);
  return new Intl.NumberFormat(locale, options).format(n);
}

