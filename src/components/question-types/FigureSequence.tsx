'use client';
import React, { useState } from 'react';
import { ResilientImage } from './ResilientImage';
import { Skeleton } from '@/components/ui/skeleton';

export interface FigureSequenceVerification {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer?: unknown;
}

interface FigureSequenceProps {
  question: {
    id: string;
    content: {
      prompt_image?: string;
      prompt_image_url?: string;
      options?: string[];
      options_urls?: string[];
    };
  };
  selectedAnswer: { image1: number | null; image2: number | null } | null;
  onAnswer: (answer: { image1: number | null; image2: number | null }) => void;
  verification?: FigureSequenceVerification;
}

export function FigureSequenceSkeleton() {
  const matrices = [1, 2, 3] as const;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none py-3">
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-6 sm:pb-8">
        <div className="grid grid-cols-[auto_auto_auto] gap-x-4 md:gap-x-8 gap-y-2 md:gap-y-4 items-center w-fit mx-auto pb-4">
          {/* Main prompt sequence skeleton (Col 1) */}
          <div className="justify-self-end mr-2 lg:mr-4 mb-4 mt-2">
            <Skeleton className="w-[280px] sm:w-[360px] md:w-[420px] h-20 md:h-28 lg:h-[100px] rounded ring-1 ring-[#E5E7EB]" />
          </div>

          {/* Image 1 Header Box (Col 2) */}
          <div className="w-20 h-20 md:w-28 md:h-28 lg:w-[100px] lg:h-[100px] border-[3px] border-black/30 flex flex-col items-center justify-center bg-slate-50 relative mb-4 mt-2">
            <span className="text-xs md:text-sm font-medium text-slate-400 absolute top-1">Image 1</span>
            <span className="text-3xl md:text-5xl font-light text-slate-300 mt-2">?</span>
            <div className="absolute -bottom-6 flex justify-center w-full">
              <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Image 2 Header Box (Col 3) */}
          <div className="w-20 h-20 md:w-28 md:h-28 lg:w-[100px] lg:h-[100px] border-[3px] border-black/30 flex flex-col items-center justify-center bg-slate-50 relative mb-4 mt-2">
            <span className="text-xs md:text-sm font-medium text-slate-400 absolute top-1">Image 2</span>
            <span className="text-3xl md:text-5xl font-light text-slate-300 mt-2">?</span>
            <div className="absolute -bottom-6 flex justify-center w-full">
              <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Rows 2-4: Matrices */}
          {matrices.map((row) => (
            <React.Fragment key={`skeleton-row-${row}`}>
              <div className="text-[#18181B] font-medium text-sm md:text-base pr-4 lg:pr-8 justify-self-end text-right">
                Matrix {row}
              </div>
              <div className="w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] border-black/20 bg-slate-50 overflow-hidden relative">
                <Skeleton className="w-full h-full rounded-none" />
              </div>
              <div className="w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] border-black/20 bg-slate-50 overflow-hidden relative">
                <Skeleton className="w-full h-full rounded-none" />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FigureSequence({
  question,
  selectedAnswer,
  onAnswer,
  verification,
}: FigureSequenceProps) {
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const content = question.content ?? {};
  const imageUrl = content.prompt_image_url || (typeof content.prompt_image === 'string' ? content.prompt_image : '');
  const optionsUrls = content.options_urls && content.options_urls.length >= 6
    ? content.options_urls
    : Array.isArray(content.options)
      ? content.options.filter((opt): opt is string => typeof opt === 'string')
      : [];

  // Parse verification state if available
  const isVerified = Boolean(verification?.isVerified);
  let correctRow1: number | null = null;
  let correctRow2: number | null = null;

  if (isVerified && verification?.correctAnswer) {
    const ca = verification.correctAnswer;
    if (Array.isArray(ca) && ca.length >= 2) {
      correctRow1 = typeof ca[0] === 'number' ? ca[0] : parseInt(String(ca[0]), 10);
      correctRow2 = typeof ca[1] === 'number' ? ca[1] : parseInt(String(ca[1]), 10);
    } else if (typeof ca === 'object' && ca !== null) {
      const obj = ca as Record<string, unknown>;
      correctRow1 = typeof obj.image1 === 'number' ? obj.image1 : parseInt(String(obj.image1), 10);
      correctRow2 = typeof obj.image2 === 'number' ? obj.image2 : parseInt(String(obj.image2), 10);
    }
  }

  // Parse the current dual answer state
  const currentAnswer = selectedAnswer || { image1: null, image2: null };

  const handleOptionClick = (imageCol: 1 | 2, matrixRow: 1 | 2 | 3) => {
    if (isVerified) return;
    const newAnswer = { ...currentAnswer };
    if (imageCol === 1) newAnswer.image1 = matrixRow;
    else newAnswer.image2 = matrixRow;
    onAnswer(newAnswer);
  };

  const handleImageRef = (node: HTMLImageElement | null, url: string) => {
    if (node && node.complete && node.naturalWidth > 0 && !loadedImages[url]) {
      setLoadedImages((prev) => ({ ...prev, [url]: true }));
    }
  };

  // No data at all yet (resolving) → skeleton. Incomplete data (all loads
  // finished, images genuinely missing) → explicit message instead of
  // shimmering forever.
  if (!imageUrl && optionsUrls.length === 0) {
    return <FigureSequenceSkeleton />;
  }
  if (!imageUrl || optionsUrls.length < 6) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[#71717A] text-center px-6">
        Question images are unavailable for this item. Please continue to the next question.
      </div>
    );
  }

  // Row and column arrays to map the layout cleanly
  const matrices = [1, 2, 3] as const;

  // Options array index mapping based on rules:
  // indices 0-2 -> Image 1 (Matrix 1, 2, 3)
  // indices 3-5 -> Image 2 (Matrix 1, 2, 3)
  const getOptionUrl = (col: 1 | 2, row: 1 | 2 | 3) => {
    const baseOffset = col === 1 ? 0 : 3;
    const idx = baseOffset + (row - 1);
    return optionsUrls[idx] || '';
  };

  const isPromptLoaded = Boolean(loadedImages[imageUrl]);

  const renderChoice = (col: 1 | 2, row: 1 | 2 | 3) => {
    const isSelected =
      col === 1 ? currentAnswer.image1 === row : currentAnswer.image2 === row;
    const optUrl = getOptionUrl(col, row);

    // A non-string option entry yields '' — render a placeholder instead of
    // handing an empty/object src to the image component.
    if (!optUrl) {
      return (
        <div
          key={`img${col}-matrix${row}`}
          className="w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] border-black/20 bg-slate-50 flex items-center justify-center text-2xl text-slate-300"
          aria-label={`Image ${col} Matrix ${row} (unavailable)`}
        >
          ?
        </div>
      );
    }
    const isChoiceLoaded = Boolean(loadedImages[optUrl]);

    const targetCorrectRow = col === 1 ? correctRow1 : correctRow2;
    const isCorrectChoice = isVerified && targetCorrectRow === row;
    const isWrongChoice = isVerified && isSelected && targetCorrectRow !== row;

    return (
      <button
        key={`img${col}-matrix${row}`}
        type="button"
        disabled={isVerified}
        onClick={isVerified ? undefined : () => handleOptionClick(col, row)}
        aria-pressed={isSelected}
        aria-label={`Image ${col} Matrix ${row}${isSelected ? ' (selected)' : ''}${isCorrectChoice ? ' (correct)' : ''}${isWrongChoice ? ' (incorrect)' : ''}`}
        className={`
          relative w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px]
          border-[3px] transition-all overflow-hidden bg-slate-50
          outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
          ${
            isCorrectChoice
              ? 'border-emerald-600 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/30'
              : isWrongChoice
                ? 'border-rose-600 bg-rose-500/10 ring-2 ring-rose-500/30'
                : isSelected
                  ? 'border-[#EA580C]'
                  : isVerified
                    ? 'border-black/20 opacity-50'
                    : 'border-black hover:border-[#EA580C]/60'
          }
        `}
      >
        {!isChoiceLoaded && (
          <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        )}
        <ResilientImage
          src={optUrl}
          alt={`Image ${col} Matrix ${row}`}
          onLoad={() => setLoadedImages((prev) => ({ ...prev, [optUrl]: true }))}
          imgRef={(node) => handleImageRef(node, optUrl)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isChoiceLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Badges: correct, wrong, or regular selection */}
        {isCorrectChoice ? (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md z-10 animate-scaleIn">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isWrongChoice ? (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md z-10 animate-scaleIn">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : isSelected ? (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#EA580C] flex items-center justify-center shadow-sm z-10">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none py-3">
        <p className="text-[13px] font-medium text-[#71717A]">Complete the sequence</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-6 sm:pb-8">
        {/* Unified 3-column Grid ensuring perfect vertical alignment everywhere.
            Thick black borders are test-content fidelity (real TestAS format), not chrome. */}
        <div className="grid grid-cols-[auto_auto_auto] gap-x-4 md:gap-x-8 gap-y-2 md:gap-y-4 items-center w-fit mx-auto pb-4">

          {/* --- ROW 1: HEADERS --- */}
          {/* Main prompt sequence image (Col 1) */}
          <div className="justify-self-end mr-2 lg:mr-4 mb-4 mt-2 relative min-w-[280px] sm:min-w-[360px] md:min-w-[420px] h-20 md:h-28 lg:h-[100px] flex items-center justify-center bg-slate-50 rounded ring-1 ring-[#E5E7EB] overflow-hidden">
            {!isPromptLoaded && (
              <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
            )}
            <ResilientImage
              src={imageUrl}
              alt="Sequence prompt"
              onLoad={() => setLoadedImages((prev) => ({ ...prev, [imageUrl]: true }))}
              imgRef={(node) => handleImageRef(node, imageUrl)}
              className={`h-20 md:h-28 lg:h-[100px] w-auto max-w-full object-contain block ring-1 ring-[#E5E7EB] transition-opacity duration-200 ${
                isPromptLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>

          {/* Image 1 Header Box (Col 2) */}
          <div className="w-20 h-20 md:w-28 md:h-28 lg:w-[100px] lg:h-[100px] border-[3px] border-black flex flex-col items-center justify-center bg-white relative mb-4 mt-2">
            <span className="text-xs md:text-sm font-medium absolute top-1">Image 1</span>
            <span className="text-3xl md:text-5xl font-light mt-2">?</span>
            <div className="absolute -bottom-6 flex justify-center w-full">
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            </div>
          </div>

          {/* Image 2 Header Box (Col 3) */}
          <div className="w-20 h-20 md:w-28 md:h-28 lg:w-[100px] lg:h-[100px] border-[3px] border-black flex flex-col items-center justify-center bg-white relative mb-4 mt-2">
            <span className="text-xs md:text-sm font-medium absolute top-1">Image 2</span>
            <span className="text-3xl md:text-5xl font-light mt-2">?</span>
            <div className="absolute -bottom-6 flex justify-center w-full">
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            </div>
          </div>

          {/* --- ROWS 2-4: MATRICES --- */}
          {matrices.map((row) => (
            <React.Fragment key={`row-${row}`}>

              {/* Matrix Label (Col 1) */}
              <div className="text-[#18181B] font-medium text-sm md:text-base pr-4 lg:pr-8 justify-self-end text-right">
                Matrix {row}
              </div>

              {/* Image 1 Choices (Col 2) */}
              {renderChoice(1, row)}

              {/* Image 2 Choices (Col 3) */}
              {renderChoice(2, row)}
            </React.Fragment>
          ))}

        </div>

      </div>
    </div>
  );
}
