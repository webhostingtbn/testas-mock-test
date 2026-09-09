'use client';
import React from 'react';
import { ResilientImage } from './ResilientImage';

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
}

export default function FigureSequence({
  question,
  selectedAnswer,
  onAnswer,
}: FigureSequenceProps) {
  const content = question.content ?? {};
  const imageUrl = content.prompt_image_url || '';
  const optionsUrls = content.options_urls || [];

  // Parse the current dual answer state
  const currentAnswer = selectedAnswer || { image1: null, image2: null };

  const handleOptionClick = (imageCol: 1 | 2, matrixRow: 1 | 2 | 3) => {
    const newAnswer = { ...currentAnswer };
    if (imageCol === 1) newAnswer.image1 = matrixRow;
    else newAnswer.image2 = matrixRow;
    onAnswer(newAnswer);
  };

  if (!imageUrl || optionsUrls.length < 6) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[#71717A]">
        Loading question images...
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
    return optionsUrls[idx];
  };

  const renderChoice = (col: 1 | 2, row: 1 | 2 | 3) => {
    const isSelected =
      col === 1 ? currentAnswer.image1 === row : currentAnswer.image2 === row;
    return (
      <button
        key={`img${col}-matrix${row}`}
        type="button"
        onClick={() => handleOptionClick(col, row)}
        aria-pressed={isSelected}
        aria-label={`Image ${col} Matrix ${row}${isSelected ? ' (selected)' : ''}`}
        className={`
          relative w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px]
          border-[3px] transition-colors overflow-hidden
          outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
          ${isSelected ? 'border-[#EA580C]' : 'border-black hover:border-[#EA580C]/60'}
        `}
      >
        <ResilientImage src={getOptionUrl(col, row)} alt={`Image ${col} Matrix ${row}`} className="w-full h-full object-cover" />
        {isSelected && (
          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#EA580C] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
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
          <div className="justify-self-end mr-2 lg:mr-4 mb-4 mt-2">
            <ResilientImage
              src={imageUrl}
              alt="Sequence prompt"
              className="h-20 md:h-28 lg:h-[100px] object-contain block ring-1 ring-[#E5E7EB]"
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
