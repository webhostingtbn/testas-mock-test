import { en } from './en';
import { de } from './de';
import type { Lang } from '../config';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;

export const messages: Record<Lang, Messages> = {
  en,
  de,
};

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type Paths<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number
          ? T[K] extends string
            ? `${K}`
            : Join<K, Paths<T[K], Prev[D]>>
          : never;
      }[keyof T]
    : '';

export type MessageKey = Paths<typeof en>;

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = messages[lang];
  const parts = key.split('.');
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  const text = typeof current === 'string' ? current : key;
  if (!vars) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, varName) => {
    return varName in vars ? String(vars[varName]) : match;
  });
}
