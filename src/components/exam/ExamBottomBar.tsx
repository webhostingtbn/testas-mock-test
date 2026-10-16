'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Flag, Smile, Meh, Frown, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';

interface ExamBottomBarProps {
  onBack: () => void;
  onNext: () => void;
  onEndSubtest: () => void;
  onEndTest?: () => void;
  showEndTest?: boolean;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  sectionTitle: string;
  isCurrentQuestionRated?: boolean;
  isRatingSaving?: boolean;
  ratingError?: string | null;
  onRetryRatingSave?: () => void;
  currentRating: 'easy' | 'medium' | 'hard' | null;
  onRatingChange: (rating: 'easy' | 'medium' | 'hard') => void;
}

export default function ExamBottomBar({
  onBack,
  onNext,
  onEndSubtest,
  onEndTest,
  showEndTest = false,
  isFirstQuestion,
  isLastQuestion,
  sectionTitle,
  isCurrentQuestionRated = false,
  isRatingSaving = false,
  ratingError = null,
  onRetryRatingSave,
  currentRating,
  onRatingChange,
}: ExamBottomBarProps) {
  const { t } = useLanguage();
  const [showEndSubtestDialog, setShowEndSubtestDialog] = useState(false);
  const [showEndTestDialog, setShowEndTestDialog] = useState(false);

  const ratingOptions = [
    { id: 'easy' as const, icon: Smile, title: t('common.easy'), activeClass: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600' },
    { id: 'medium' as const, icon: Meh, title: t('common.medium'), activeClass: 'bg-amber-500 hover:bg-amber-400 text-white border-amber-500' },
    { id: 'hard' as const, icon: Frown, title: t('common.hard'), activeClass: 'bg-rose-500 hover:bg-rose-400 text-white border-rose-500' },
  ];

  // Navigation gates on the LOCAL rating only. Server sync runs in the
  // background (isRatingSaving is display-only) and failures surface as a
  // non-blocking retry banner.
  const isActionDisabled = !isCurrentQuestionRated;

  return (
    <>
      <div className="bg-white border-t border-slate-200 shadow-xs shrink-0 z-30">
        {/* Rating save error banner */}
        {ratingError && (
          <div className="mx-auto px-6 py-2 flex items-center gap-2 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{t('exam.ratingSyncFailed', { error: ratingError })}</span>
            {onRetryRatingSave && (
              <button
                type="button"
                onClick={onRetryRatingSave}
                className="flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-200 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                {t('common.retry')}
              </button>
            )}
          </div>
        )}

        <div className="mx-auto px-4 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Left: Back button (icon-only on small screens) */}
          <div className="flex-1 flex justify-start">
            <Button
              onClick={onBack}
              disabled={isFirstQuestion || isActionDisabled}
              variant="outline"
              className="h-11 px-3 lg:px-6 text-sm font-medium border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-25 transition-all duration-150"
              title={isActionDisabled && !isFirstQuestion ? t('exam.rateCurrentToNavigate') : undefined}
            >
              <ChevronLeft className="w-4 h-4 sm:mr-1" />
              <span className="hidden lg:inline">{t('common.back')}</span>
            </Button>
          </div>

          {/* Middle: Rating pills — full row on top for small screens */}
          <div className="order-first md:order-0 basis-full sm:basis-auto flex px-2 items-center md:*:justify-center sm:justify-start gap-1.5">
            <span className="hidden lg:inline text-[13px] font-medium text-[#71717A] mr-1">{t('exam.rateToProceed')}</span>
            <span className="lg:hidden text-[13px] font-medium text-[#71717A] mr-1">{t('practice.rate')}</span>
            {ratingOptions.map((opt) => {
              const isActive = currentRating === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRatingChange(opt.id)}
                  title={opt.title}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? `${opt.activeClass}`
                      : 'bg-white border-[#E5E7EB] text-[#71717A] hover:text-[#18181B] hover:border-[#D1D5DB]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {opt.title}
                </button>
              );
            })}
            {isRatingSaving && (
              <span className="text-[10px] font-medium text-slate-400 animate-pulse px-1">
                {t('exam.syncing')}
              </span>
            )}
          </div>

          {/* Right: End Test, End Subtest, Next (icon-only on small screens) */}
          <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
            {showEndTest && onEndTest && (
              <Button
                onClick={() => setShowEndTestDialog(true)}
                disabled={isActionDisabled}
                variant="outline"
                className="h-11 px-3 sm:px-4 text-sm font-medium border border-rose-200 text-rose-650 bg-rose-50 hover:bg-rose-100 transition-all duration-150 disabled:opacity-25"
                title={isActionDisabled ? t('exam.rateCurrentFirst') : undefined}
              >
                <XCircle className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('exam.endTest')}</span>
              </Button>
            )}

            <Button
              onClick={() => setShowEndSubtestDialog(true)}
              disabled={isActionDisabled}
              variant="outline"
              className="h-11 px-3 sm:px-4 text-sm font-medium border border-orange-200 text-orange-650 bg-orange-50 hover:bg-orange-100 transition-all duration-150 disabled:opacity-25"
              title={isActionDisabled ? t('exam.rateCurrentToEndSubtest') : undefined}
            >
              <Flag className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('exam.endSubtest')}</span>
            </Button>

            <Button
              onClick={onNext}
              disabled={isLastQuestion || isActionDisabled}
              className="h-11 px-3 lg:px-8 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/15 disabled:opacity-25 transition-all duration-150 border-0"
              title={isActionDisabled ? t('exam.rateCurrentFirst') : undefined}
            >
              <span className="hidden lg:inline">{t('common.next')}</span>
              <ChevronRight className="w-4 h-4 lg:ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* End Subtest Confirmation Dialog */}
      <Dialog open={showEndSubtestDialog} onOpenChange={setShowEndSubtestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('exam.endSubtestTitle')}</DialogTitle>
            <DialogDescription className="text-sm">
              {t('exam.endSubtestDesc', { title: sectionTitle })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowEndSubtestDialog(false)}
              className="flex-1 sm:flex-none"
            >
              {t('exam.continueTest')}
            </Button>
            <Button
              onClick={() => {
                setShowEndSubtestDialog(false);
                onEndSubtest();
              }}
              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('exam.endSubtest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Test Confirmation Dialog (red/rose styling) */}
      <Dialog open={showEndTestDialog} onOpenChange={setShowEndTestDialog}>
        <DialogContent className="sm:max-w-md border-rose-200">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="grid size-9 place-items-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="size-4.5" />
              </div>
              <DialogTitle className="text-lg text-rose-900">{t('exam.endTestTitle')}</DialogTitle>
            </div>
            <DialogDescription className="text-sm space-y-2">
              <span className="block">{t('exam.endTestDesc')}</span>
              <span className="block text-rose-700 font-medium">{t('exam.endTestBullet1')}</span>
              <span className="block text-rose-700 font-medium">{t('exam.endTestBullet2')}</span>
              <span className="block text-rose-700 font-medium">{t('exam.endTestBullet3')}</span>
              <span className="block text-rose-700 font-medium">{t('exam.endTestBullet4')}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowEndTestDialog(false)}
              className="flex-1 sm:flex-none"
            >
              {t('exam.continueTest')}
            </Button>
            <Button
              onClick={() => {
                setShowEndTestDialog(false);
                onEndTest?.();
              }}
              className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white"
            >
              {t('exam.endTest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
