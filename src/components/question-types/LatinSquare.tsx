'use client';

import { CanvasImage } from './CanvasImage';

interface LatinSquareContent {
  grid_image?: string;
  grid_image_url?: string;
  options?: string[];
}

export interface LatinSquareVerification {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer?: unknown;
}

interface LatinSquareProps {
  question: {
    id: string;
    content: LatinSquareContent;
  };
  selectedAnswer: string | null;
  onAnswer: (letter: string) => void;
  verification?: LatinSquareVerification;
}

const FALLBACK_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function LatinSquare({
  question,
  selectedAnswer,
  onAnswer,
  verification,
}: LatinSquareProps) {
  const content = question.content ?? {};
  const imageUrl = content.grid_image_url || content.grid_image || '';
  const options =
    content.options && content.options.length > 0 ? content.options : FALLBACK_OPTIONS;

  const isVerified = Boolean(verification?.isVerified);
  const correctLetter = isVerified && verification?.correctAnswer ? String(verification.correctAnswer).trim().toUpperCase() : null;

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[#71717A]">
        Loading question...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Pane label */}
      <div className="flex-none py-3">
        <p className="text-[13px] font-medium text-[#71717A]">Find the missing letter</p>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:divide-x lg:divide-[#E5E7EB]">
        {/* Left pane: grid puzzle — zoomable canvas, no nested card */}
        <div className="flex-1 min-h-0 flex flex-col px-6 sm:px-8 pb-6 lg:py-6">
          <div className="w-full max-w-2xl mx-auto h-[320px] sm:h-[400px] lg:h-[440px] shrink-0 overflow-hidden rounded-xl">
            <CanvasImage src={imageUrl} alt="Latin square puzzle" />
          </div>
        </div>

        {/* Right pane: answer options */}
        <div className="w-full lg:w-[300px] shrink-0 flex flex-col px-6 sm:px-8 pb-6 sm:pb-8 lg:py-6">
          <p className="text-[13px] font-medium text-[#71717A] mb-4">Select answer</p>
          <div
            role="radiogroup"
            aria-label="Answer options"
            className="grid grid-cols-5 lg:grid-cols-2 gap-[10px]"
          >
            {options.map((letter) => {
              const isSelected = selectedAnswer === letter;
              const isCorrectChoice = isVerified && letter === correctLetter;
              const isWrongChoice = isVerified && isSelected && letter !== correctLetter;

              return (
                <button
                  key={letter}
                  type="button"
                  role="radio"
                  disabled={isVerified}
                  aria-checked={isSelected}
                  onClick={isVerified ? undefined : () => onAnswer(letter)}
                  className={`
                    h-12 md:h-14 rounded-[10px] border text-xl font-semibold
                    flex items-center justify-center transition-all
                    outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
                    ${
                      isCorrectChoice
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/30 font-bold'
                        : isWrongChoice
                          ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/30 line-through'
                          : isSelected
                            ? 'border-[#EA580C]/40 bg-[#FFF7ED]/60 text-[#EA580C]'
                            : isVerified
                              ? 'border-[#E5E7EB] bg-white text-slate-400 opacity-50'
                              : 'border-[#E5E7EB] bg-white text-[#18181B] hover:border-[#D1D5DB] hover:bg-[#FAFAFA]'
                    }
                  `}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
