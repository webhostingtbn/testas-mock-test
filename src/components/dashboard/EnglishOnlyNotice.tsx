'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';

export interface EnglishOnlyNoticeProps {
  text?: string;
}

export function EnglishOnlyNotice({ text }: EnglishOnlyNoticeProps) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-medium">
      {text ?? t('common.onlyEnglishAvailable')}
    </div>
  );
}

