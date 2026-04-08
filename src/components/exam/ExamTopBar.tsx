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
}

export default function ExamTopBar({
  sectionTitle,
  totalQuestions,
  currentQuestionIndex,
  answeredQuestions,
  onQuestionClick,
  onTimeUp,
}: ExamTopBarProps) {
  const { fontSize, setFontSize } = useExamStore();

  const fontSizeOptions = [
    { size: FONT_SIZES.SMALL, label: "A" },
    { size: FONT_SIZES.MEDIUM, label: "A" },
    { size: FONT_SIZES.LARGE, label: "A" },
  ];

  return (
    <div className="bg-linear-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200/50 shrink-0 w-full relative">
      {/* Main top bar row */}
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        {/* Left: Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <CircularTimer onTimeUp={onTimeUp} />
          <h2 className="text-sm font-black uppercase tracking-wider text-orange-100 flex items-center">
            {sectionTitle}
          </h2>
        </div>

        {/* Right: Font size toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <Type className="w-4 h-4 text-orange-200 mr-1" />
          {fontSizeOptions.map(({ size, label }, idx) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                fontSize === size
                  ? "bg-white/25 text-white font-bold shadow-inner"
                  : "text-orange-200 hover:bg-white/10"
              }`}
              style={{ fontSize: `${12 + idx * 3}px` }}
              title={`Font size ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Center: Pagination */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-40">
        <div className="pointer-events-auto">
          <QuestionPagination
            totalQuestions={totalQuestions}
            currentIndex={currentQuestionIndex}
            answeredIndices={answeredQuestions}
            onQuestionClick={onQuestionClick}
          />
        </div>
      </div>
    </div>
  );
}
