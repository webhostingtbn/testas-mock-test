'use client';

import React, { useState } from 'react';
import { CanvasImage } from './CanvasImage';

interface CompletingPatternsProps {
  question: {
    id: string;
    content: {
      grid_image_url: string;
      options_image_url: string;
      options_layout?: {
        rows: number;
        cols: number;
        options: string[];
      };
    };
  };
  selectedAnswer: string | null;
  onAnswer: (letter: string) => void;
}

export default function CompletingPatterns({
  question,
  selectedAnswer,
  onAnswer,
}: CompletingPatternsProps) {
  const [optionsAspectRatio, setOptionsAspectRatio] = useState(570 / 510);
  const content = question.content ?? {};
  const gridUrl = content.grid_image_url || '';
  const optionsUrl = content.options_image_url || '';
  
  // Default to a standard 2 rows x 3 columns layout (options A to F)
  const layout = content.options_layout ?? {
    rows: 2,
    cols: 3,
    options: ['A', 'B', 'C', 'D', 'E', 'F'],
  };

  if (!gridUrl || !optionsUrl) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white rounded-2xl border border-orange-100/60 shadow-sm">
        Loading question images...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Question Header Label */}
      <div className="flex items-center gap-2 flex-none">
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Complete the pattern
        </span>
      </div>

      {/* Main Panel Layout (Responsive Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Panel: 3x3 Question Grid (Lg: Col-span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col justify-start items-center space-y-4 h-full min-h-0">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider self-start flex-none">
            Question Pattern
          </h3>
          <div className="w-full flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            <CanvasImage src={gridUrl} alt="Completing patterns 3x3 grid" />
          </div>
        </div>

        {/* Right Panel: Options unified Image with Clickable Overlay (Lg: Col-span 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col justify-start space-y-4 h-full min-h-0">
          <div className="flex flex-col gap-1 flex-none">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Select Answer Option
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Click directly on the letter box in the image below to make your choice.
            </p>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center w-full">
            {(() => {
              return (
                <div
                  style={{ aspectRatio: String(optionsAspectRatio) }}
                  className="group relative w-full max-w-full overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm"
                >
                  {/* The unified image containing all 6 options */}
                  <img
                    src={optionsUrl}
                    alt="Answer options A through F"
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (image.naturalWidth && image.naturalHeight) {
                        setOptionsAspectRatio(image.naturalWidth / image.naturalHeight);
                      }
                    }}
                    className="w-full h-full object-contain block pointer-events-none select-none"
                  />

                  {/* Interactive Grid Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '1%',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                      rowGap: '8.5%',
                    }}
                  >
                    {layout.options.map((opt) => {
                      const isSelected = selectedAnswer === opt;
                      
                      return (
                        <button
                          key={opt}
                          onClick={() => onAnswer(opt)}
                          className={`
                            group/cell relative h-full w-full cursor-pointer focus:outline-none
                            focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset
                          `}
                          aria-label={`Option ${opt}`}
                          aria-pressed={isSelected}
                        >
                          {/* Highlight only the illustration area, not the printed answer label. */}
                          <span
                            aria-hidden="true"
                            className={`
                              pointer-events-none absolute inset-x-[3%] top-[3%] bottom-[21%] rounded-md border-2 transition-all duration-200
                              ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-500/10 shadow-inner'
                                  : 'border-transparent group-hover/cell:border-orange-400/50 group-hover/cell:bg-orange-500/5'
                              }
                            `}
                          />

                          {/* Hover indicator badge with option letter */}
                          <span className={`
                            absolute left-[7%] top-[7%] rounded px-2 py-0.5 text-[10px] font-extrabold shadow-sm transition-all duration-150 md:text-xs
                            ${
                              isSelected
                                ? 'bg-orange-600 text-white opacity-100 scale-105'
                                : 'bg-slate-700/80 text-white backdrop-blur-xs opacity-0 group-hover/cell:opacity-90 group-hover:opacity-40'
                            }
                          `}>
                            {opt}
                          </span>

                          {/* Active Selected Checkmark */}
                          {isSelected && (
                            <div className="animate-scaleIn absolute right-[7%] top-[7%] flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white shadow-md md:h-6 md:w-6">
                              <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
