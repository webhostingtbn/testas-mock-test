'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';

export default function SecurityOverlay() {
  const [isBlurred, setIsBlurred] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check in case window starts blurred
    if (!document.hasFocus() || document.hidden) {
      setIsBlurred(true);
    }

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!isBlurred) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-2xl bg-slate-900/75 animate-fade-in">
      <div className="bg-slate-800/80 border border-slate-700/50 p-8 rounded-2xl max-w-sm shadow-2xl flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20 shadow-inner">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">{t('exam.contentProtected')}</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {t('exam.contentProtectedDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.focus();
            setIsBlurred(false);
          }}
          className="mt-2 w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          {t('exam.returnToTest')}
        </button>
      </div>
    </div>
  );
}
