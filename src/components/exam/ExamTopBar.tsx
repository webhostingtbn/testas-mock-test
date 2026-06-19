"use client";

import CircularTimer from "./CircularTimer";
import QuestionPagination from "./QuestionPagination";
import { useExamStore } from "@/lib/store/exam-store";
import { FONT_SIZES } from "@/lib/constants";
import { Type } from "lucide-react";

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
  const { fontSize, setFontSize } = useExamStore();

  const fontSizeOptions = [
    { size: FONT_SIZES.SMALL, label: "A" },
    { size: FONT_SIZES.MEDIUM, label: "A" },
    { size: FONT_SIZES.LARGE, label: "A" },
  ];

  return (
    <div className="bg-white border-b border-slate-200 text-slate-800 backdrop-blur-xl shrink-0 w-full relative z-10 shadow-sm shadow-slate-100/40">
      <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-y-4 gap-x-4">
        {/* Left: Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <CircularTimer onTimeUp={onTimeUp} />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center">
            {sectionTitle}
          </h2>
        </div>

        {/* Center: Pagination */}
        <div className="flex-1 flex justify-center min-w-62.5 order-last xl:order-0 w-full xl:w-auto">
          <QuestionPagination
            totalQuestions={totalQuestions}
            currentIndex={currentQuestionIndex}
            answeredIndices={answeredQuestions}
            onQuestionClick={onQuestionClick}
            isCurrentQuestionRated={isCurrentQuestionRated}
          />
        </div>

        {/* Right: Font size toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <Type className="w-4 h-4 text-orange-500 mr-1" />
          {fontSizeOptions.map(({ size, label }, idx) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                fontSize === size
                  ? "bg-orange-100 text-orange-700 font-bold shadow-inner border border-orange-200"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
              style={{ fontSize: `${12 + idx * 3}px` }}
              title={`Font size ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
