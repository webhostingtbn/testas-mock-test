'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_LANG, type Lang, isLang } from '@/lib/i18n/config';
import { translate, type MessageKey } from '@/lib/i18n/messages';
import { usePracticeStore } from '@/lib/store/practice-store';
import { useUserStore } from '@/lib/store/user-store';

interface LanguageContextValue {
  lang: Lang;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLanguage: (nextLang: Lang) => Promise<void>;
  isUpdating: boolean;
  disabled?: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export interface LanguageProviderProps {
  initialLang?: Lang;
  disabled?: boolean;
  children: React.ReactNode;
}

export function LanguageProvider({
  initialLang = DEFAULT_LANG,
  disabled = false,
  children,
}: LanguageProviderProps) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const [isUpdating, setIsUpdating] = useState(false);
  const userProfileLang = useUserStore((state) => state.profile?.preferred_language);

  // Keep state in sync if initialLang changes (e.g. nested exam wrapper)
  useEffect(() => {
    if (initialLang && isLang(initialLang)) {
      setLang(initialLang);
    }
  }, [initialLang]);

  // Reconcile: adopt preferred_language when profile loads if it differs (no PUT)
  useEffect(() => {
    if (disabled) return;
    if (userProfileLang && isLang(userProfileLang)) {
      setLang((curr) => (curr !== userProfileLang ? userProfileLang : curr));
    }
  }, [disabled, userProfileLang]);

  const setLanguage = useCallback(
    async (nextLang: Lang) => {
      if (disabled || nextLang === lang || !isLang(nextLang)) {
        return;
      }

      setIsUpdating(true);
      try {
        const res = await fetch('/api/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: nextLang }),
        });

        if (res.ok) {
          setLang(nextLang);
          usePracticeStore.getState().reset();
          router.refresh();
        }
      } catch (error) {
        console.error('Failed to update language:', error);
      } finally {
        setIsUpdating(false);
      }
    },
    [disabled, lang, router],
  );

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      return translate(lang, key, vars);
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      t,
      setLanguage,
      isUpdating,
      disabled,
    }),
    [lang, t, setLanguage, isUpdating, disabled],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
