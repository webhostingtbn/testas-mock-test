'use client';
import React from 'react';

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
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
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

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Complete the sequence
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col items-center justify-center w-full overflow-x-auto">
        
        {/* Unified 3-column Grid ensuring perfect vertical alignment everywhere */}
        <div className="grid grid-cols-[auto_auto_auto] gap-x-4 md:gap-x-8 gap-y-4 items-center w-fit mx-auto">
          
          {/* --- ROW 1: HEADERS --- */}
          {/* Main prompt sequence image (Col 1) */}
          <div className="justify-self-end mr-2 lg:mr-4 mb-8 mt-4">
            <img 
              src={imageUrl} 
              alt="Sequence prompt" 
              className="h-24 md:h-32 lg:h-[120px] object-contain block ring-1 ring-gray-200" 
            />
          </div>

          {/* Image 1 Header Box (Col 2) */}
          <div className="w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] border-black flex flex-col items-center justify-center bg-white shadow-sm relative mb-8 mt-4">
            <span className="text-xs md:text-sm font-medium absolute top-2">Image 1</span>
            <span className="text-4xl md:text-6xl font-light mt-4">?</span>
            <div className="absolute -bottom-8 flex justify-center w-full">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            </div>
          </div>
            
          {/* Image 2 Header Box (Col 3) */}
          <div className="w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] border-black flex flex-col items-center justify-center bg-white shadow-sm relative mb-8 mt-4">
            <span className="text-xs md:text-sm font-medium absolute top-2">Image 2</span>
            <span className="text-4xl md:text-6xl font-light mt-4">?</span>
            <div className="absolute -bottom-8 flex justify-center w-full">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            </div>
          </div>

          {/* --- ROWS 2-4: MATRICES --- */}
          {matrices.map((row) => (
            <React.Fragment key={`row-${row}`}>

              {/* Matrix Label (Col 1) */}
              <div className="text-gray-800 font-medium text-sm md:text-base pr-4 lg:pr-8 justify-self-end text-right">
                Matrix {row}
              </div>

              {/* Image 1 Choices (Col 2) */}
              <button
                onClick={() => handleOptionClick(1, row)}
                className={`
                  relative w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] transition-all duration-200 overflow-hidden group
                  ${
                    currentAnswer.image1 === row
                      ? 'border-orange-500 ring-4 ring-orange-200 z-10 scale-[1.02]'
                      : 'border-black hover:border-orange-400 z-0'
                  }
                `}
              >
                <img src={getOptionUrl(1, row)} alt={`Image 1 Matrix ${row}`} className="w-full h-full object-cover" />
                {currentAnswer.image1 === row && (
                  <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center shadow-lg">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Image 2 Choices (Col 4) */}
              <button
                onClick={() => handleOptionClick(2, row)}
                className={`
                  relative w-24 h-24 md:w-32 md:h-32 lg:w-[120px] lg:h-[120px] border-[3px] transition-all duration-200 overflow-hidden group
                  ${
                    currentAnswer.image2 === row
                      ? 'border-orange-500 ring-4 ring-orange-200 z-10 scale-[1.02]'
                      : 'border-black hover:border-orange-400 z-0'
                  }
                `}
              >
                <img src={getOptionUrl(2, row)} alt={`Image 2 Matrix ${row}`} className="w-full h-full object-cover" />
                {currentAnswer.image2 === row && (
                  <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center shadow-lg">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </React.Fragment>
          ))}
          
        </div>

      </div>
    </div>
  );
}
