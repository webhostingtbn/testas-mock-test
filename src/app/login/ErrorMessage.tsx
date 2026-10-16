'use client';

import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';

export default function ErrorMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const { t } = useLanguage();

  if (!error) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md flex items-center gap-2 text-sm border border-red-100">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <p>
        {error === 'OAuthCallback' && t('auth.oauthCallbackError')}
        {error === 'AccessDenied' && t('auth.accessDeniedError')}
        {error === 'Configuration' && t('auth.configError')}
        {error !== 'OAuthCallback' && error !== 'AccessDenied' && error !== 'Configuration' && t('auth.authErrorPrefix', { error })}
      </p>
    </div>
  );
}