'use client';

import React, { useState, useEffect } from 'react';
import { CanvasImage } from './CanvasImage';
import { ResilientImage } from './ResilientImage';

export interface CompletingPatternsVerification {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer?: unknown;
}

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
  verification?: CompletingPatternsVerification;
}

export default function CompletingPatterns({
  question,
  selectedAnswer,
  onAnswer,
  verification,
}: CompletingPatternsProps) {
  const content = question.content ?? {};
  const gridUrl = content.grid_image_url || '';
  const optionsUrl = content.options_image_url || '';

  // Detect if this is an 8-option question
  const isEightOptions =
    optionsUrl.includes('_8') ||
    gridUrl.includes('_8') ||
    question.id.includes('_8');

  // Default aspect ratio for 8 options is wider (e.g. 800/400 = 2), for 6 options it is 570/510 (1.117)
  const defaultAspectRatio = isEightOptions ? 800 / 400 : 570 / 510;
  const [optionsAspectRatio, setOptionsAspectRatio] = useState(defaultAspectRatio);

  // Sync aspect ratio defaults when image URL changes
  useEffect(() => {
    setOptionsAspectRatio(isEightOptions ? 800 / 400 : 570 / 510);
  }, [optionsUrl, isEightOptions]);

  // Default to a standard 2 rows x 3 columns layout (options A to F) or 2 rows x 4 columns layout for 8 options
  const layout = content.options_layout ?? {
    rows: 2,
    cols: isEightOptions ? 4 : 3,
    options: isEightOptions
      ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      : ['A', 'B', 'C', 'D', 'E', 'F'],
  };

  if (!gridUrl || !optionsUrl) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white rounded-2xl border border-orange-100/60 shadow-sm">
        Loading question images...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      {/* Question Header Label */}
      <div className="flex items-center gap-2 flex-none">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Complete the pattern
        </span>
      </div>

      {/* Main Panel Layout (Responsive Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch w-full min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Panel: 3x3 Question Grid */}
        {/* <div className={`bg-white rounded-2xl border border-gray-200 p-3 md:p-4 shadow-sm flex flex-col justify-start items-center space-y-2 h-full min-h-0 ${
          isEightOptions ? 'lg:col-span-6' : 'lg:col-span-7'
        }`}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider self-start flex-none">
            Question Pattern
          </h3>
          
        </div> */}
        <div className={`w-full flex-1 h-full flex items-center justify-center min-h-0 overflow-hidden ${
          isEightOptions ? 'lg:col-span-6' : 'lg:col-span-7'
        }`}>
          <CanvasImage src={gridUrl} alt="Completing patterns 3x3 grid" />
        </div>

        {/* Right Panel: Options unified Image with Clickable Overlay */}
        <div className={`bg-white rounded-2xl border border-gray-200 p-3 md:p-4 shadow-sm flex flex-col justify-start space-y-2 h-full min-h-0 ${
          isEightOptions ? 'lg:col-span-6' : 'lg:col-span-5'
        }`}>
          <div className="flex items-baseline justify-between flex-none gap-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Select Answer Option
            </h3>
            <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
              Click directly on the letter box
            </span>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center w-full">
            <div
              style={{ aspectRatio: String(optionsAspectRatio) }}
              className="group relative w-full max-w-full overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm"
            >
              {/* The unified image containing all options */}
              <ResilientImage
                src={optionsUrl}
                alt={isEightOptions ? "Answer options A through H" : "Answer options A through F"}
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
                  rowGap: isEightOptions ? '8%' : '8.5%',
                }}
              >
                {layout.options.map((opt) => {
                  const isSelected = selectedAnswer === opt;
                  const isVerified = Boolean(verification?.isVerified);
                  const correctOpt = isVerified && verification?.correctAnswer ? String(verification.correctAnswer).trim().toUpperCase() : null;
                  const isCorrectChoice = isVerified && opt === correctOpt;
                  const isWrongChoice = isVerified && isSelected && opt !== correctOpt;
                  
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isVerified}
                      onClick={isVerified ? undefined : () => onAnswer(opt)}
                      className={`
                        group/cell relative h-full w-full focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset
                        ${isVerified ? 'cursor-default' : 'cursor-pointer'}
                      `}
                      aria-label={`Option ${opt}${isSelected ? ' (selected)' : ''}${isCorrectChoice ? ' (correct)' : ''}${isWrongChoice ? ' (incorrect)' : ''}`}
                      aria-pressed={isSelected}
                    >
                      {/* Highlight only the illustration area, not the printed answer label. */}
                      <span
                        aria-hidden="true"
                        className={`
                          pointer-events-none absolute inset-x-[3%] top-[3%] bottom-[21%] rounded-md border-2 transition-all duration-200
                          ${
                            isCorrectChoice
                              ? 'border-emerald-600 bg-emerald-500/20 shadow-md ring-2 ring-emerald-500/30'
                              : isWrongChoice
                                ? 'border-rose-600 bg-rose-500/20 shadow-md ring-2 ring-rose-500/30'
                                : isSelected
                                  ? 'border-orange-500 bg-orange-500/10 shadow-inner'
                                  : isVerified
                                    ? 'border-transparent opacity-40'
                                    : 'border-transparent group-hover/cell:border-orange-400/50 group-hover/cell:bg-orange-500/5'
                          }
                        `}
                      />

                      {/* Hover indicator badge with option letter */}
                      <span className={`
                        absolute left-[7%] top-[7%] rounded px-2 py-0.5 text-[10px] font-extrabold shadow-sm transition-all duration-150 md:text-xs
                        ${
                          isCorrectChoice
                            ? 'bg-emerald-600 text-white opacity-100 scale-105'
                            : isWrongChoice
                              ? 'bg-rose-600 text-white opacity-100 scale-105'
                              : isSelected
                                ? 'bg-orange-600 text-white opacity-100 scale-105'
                                : 'bg-slate-700/80 text-white backdrop-blur-xs opacity-0 group-hover/cell:opacity-90 group-hover:opacity-40'
                        }
                      `}>
                        {opt}
                      </span>

                      {/* Verification / Active Selected Checkmark */}
                      {isCorrectChoice ? (
                        <div className="animate-scaleIn absolute right-[7%] top-[7%] flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md md:h-6 md:w-6 z-10">
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : isWrongChoice ? (
                        <div className="animate-scaleIn absolute right-[7%] top-[7%] flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-md md:h-6 md:w-6 z-10">
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : isSelected ? (
                        <div className="animate-scaleIn absolute right-[7%] top-[7%] flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white shadow-md md:h-6 md:w-6 z-10">
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
