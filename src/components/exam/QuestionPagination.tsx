'use client';

import { useLanguage } from '@/components/i18n/LanguageProvider';

interface QuestionPaginationProps {
  totalQuestions: number;
  currentIndex: number;
  answeredIndices: number[];
  onQuestionClick: (index: number) => void;
  isCurrentQuestionRated?: boolean;
}

export default function QuestionPagination({
  totalQuestions,
  currentIndex,
  answeredIndices,
  onQuestionClick,
  isCurrentQuestionRated = false,
}: QuestionPaginationProps) {
  const { t } = useLanguage();
  const answeredSet = new Set(answeredIndices);

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {Array.from({ length: totalQuestions }, (_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredSet.has(i);
        const isDisabled = !isCurrentQuestionRated && !isCurrent;

        return (
          <button
            key={i}
            onClick={() => onQuestionClick(i)}
            disabled={isDisabled}
            className={`
              w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[11px] sm:text-xs font-bold
              transition-all duration-150 
              ${
                isCurrent
                  ? 'bg-orange-600 text-white shadow-md scale-110 ring-2 ring-orange-500/50'
                  : isAnswered
                  ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100/80 hover:shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/80'
              }
              ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
            `}
            title={
              isDisabled 
                ? t('exam.rateCurrentToNavigate') 
                : `${t('common.questions')} ${i + 1}${isAnswered ? ` (${t('practice.answered').toLowerCase()})` : ''}`
            }
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
