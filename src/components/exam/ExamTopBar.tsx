"use client";

import CircularTimer from "./CircularTimer";
import QuestionPagination from "./QuestionPagination";

interface ExamTopBarProps {
  sectionTitle: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  answeredQuestions: number[];
  onQuestionClick: (index: number) => void;
  onTimeUp: () => void;
  isCurrentQuestionRated?: boolean;
}

export default function ExamTopBar({
  sectionTitle,
  totalQuestions,
  currentQuestionIndex,
  answeredQuestions,
  onQuestionClick,
  onTimeUp,
  isCurrentQuestionRated = false,
}: ExamTopBarProps) {
  return (
    <div className="bg-white border-b border-slate-200 text-slate-800 backdrop-blur-xl shrink-0 w-full relative z-10 shadow-sm shadow-slate-100/40">
      <div className="flex flex-wrap items-center px-3 sm:px-4 py-2 sm:py-3 gap-y-2 sm:gap-y-4 gap-x-4">
        {/* Left: Timer + section title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <CircularTimer onTimeUp={onTimeUp} />
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 leading-snug line-clamp-2 lg:line-clamp-none max-w-[25vw] lg:max-w-none">
            {sectionTitle}
          </h2>
        </div>

        {/* Question selection, left-aligned */}
        <div className="flex-1 flex justify-center sm:justify-end min-w-62.5">
          <QuestionPagination
            totalQuestions={totalQuestions}
            currentIndex={currentQuestionIndex}
            answeredIndices={answeredQuestions}
            onQuestionClick={onQuestionClick}
            isCurrentQuestionRated={isCurrentQuestionRated}
          />
        </div>
      </div>
    </div>
  );
}
