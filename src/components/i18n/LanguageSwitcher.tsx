'use client';

import React from 'react';
import { useLanguage } from './LanguageProvider';
import { LANGUAGES, type Lang } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  showIcon?: boolean;
}

const LANGUAGE_LABELS: Record<Lang, string> = {
  en: 'English',
  de: 'Deutsch',
};

export function LanguageSwitcher({ className, showIcon = true }: LanguageSwitcherProps) {
  const { lang, setLanguage, isUpdating, disabled } = useLanguage();

  if (disabled) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 text-xs shadow-xs backdrop-blur-xs transition',
        className,
      )}
    >
      {showIcon && (
        <span className="pl-1.5 pr-0.5 text-slate-400">
          <Globe className="size-3.5" />
        </span>
      )}
      {LANGUAGES.map((l) => {
        const isActive = lang === l;
        return (
          <button
            key={l}
            type="button"
            disabled={isUpdating}
            onClick={() => setLanguage(l)}
            aria-pressed={isActive}
            className={cn(
              'cursor-pointer rounded-full px-2.5 py-1 font-semibold transition-all',
              isActive
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              isUpdating && 'cursor-not-allowed opacity-60',
            )}
          >
            {LANGUAGE_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
