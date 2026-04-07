'use client';

interface QuestionPaginationProps {
  totalQuestions: number;
  currentIndex: number;
  answeredIndices: number[];
  onQuestionClick: (index: number) => void;
}

export default function QuestionPagination({
  totalQuestions,
  currentIndex,
  answeredIndices,
  onQuestionClick,
}: QuestionPaginationProps) {
  const answeredSet = new Set(answeredIndices);

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {Array.from({ length: totalQuestions }, (_, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredSet.has(i);

        return (
          <button
            key={i}
            onClick={() => onQuestionClick(i)}
            className={`
              w-8 h-8 rounded-lg text-xs font-bold
              transition-all duration-150 
              ${
                isCurrent
                  ? 'bg-white text-orange-600 shadow-md scale-110 ring-2 ring-white/50'
                  : isAnswered
                  ? 'bg-white/30 text-white hover:bg-white/40'
                  : 'bg-transparent text-orange-200 border border-orange-300/40 hover:bg-white/10'
              }
            `}
            title={`Question ${i + 1}${isAnswered ? ' (answered)' : ''}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
