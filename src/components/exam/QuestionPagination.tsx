'use client';

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
              w-8 h-8 rounded-lg text-xs font-bold
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
                ? "Rate the current question first to navigate" 
                : `Question ${i + 1}${isAnswered ? ' (answered)' : ''}`
            }
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
