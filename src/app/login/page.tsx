'use client';

import { LoginButton } from '@/components/auth/LoginButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { Suspense } from 'react';
import ErrorMessage from './ErrorMessage';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import Image from 'next/image';
import { useEffect } from 'react';

export default function LoginPage() {
  const { t } = useLanguage();

  useEffect(() => {
    if (window.location.hostname === '0.0.0.0' || window.location.hostname === '127.0.0.1') {
      const canonicalUrl = new URL(window.location.href);
      canonicalUrl.hostname = 'localhost';
      window.location.replace(canonicalUrl);
    }
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Image 
            src="/logo.webp" 
            alt="TestAS Logo" 
            width={80} 
            height={80} 
            priority
            className="w-20 h-auto mb-4" 
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> {t('auth.mockTestWord')}</span>
          </h1>
          <p className="text-gray-500 mt-2">
            {t('auth.mockTestSubtitle')}
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{t('auth.welcomeTitle')}</CardTitle>
            <CardDescription>
              {t('auth.welcomeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Suspense fallback={null}>
              <ErrorMessage />
            </Suspense>
            
            <LoginButton />

            <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
              <BookOpen className="w-4 h-4 shrink-0" />
              <p>{t('auth.examConditionsNotice')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
