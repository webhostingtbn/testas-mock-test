'use client';

import { CanvasImage } from './CanvasImage';

interface LatinSquareContent {
  grid_image?: string;
  grid_image_url?: string;
  options?: string[];
}

interface LatinSquareProps {
  question: {
    id: string;
    content: LatinSquareContent;
  };
  selectedAnswer: string | null;
  onAnswer: (letter: string) => void;
}

const FALLBACK_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function LatinSquare({
  question,
  selectedAnswer,
  onAnswer,
}: LatinSquareProps) {
  const content = question.content ?? {};
  const imageUrl = content.grid_image_url || content.grid_image || '';
  const options =
    content.options && content.options.length > 0 ? content.options : FALLBACK_OPTIONS;

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

              return (
                <button
                  key={letter}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onAnswer(letter)}
                  className={`
                    h-12 md:h-14 rounded-[10px] border text-xl font-semibold
                    flex items-center justify-center transition-colors
                    outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
                    ${
                      isSelected
                        ? 'border-[#EA580C]/40 bg-[#FFF7ED]/60 text-[#EA580C]'
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
