'use client';

import React from 'react';
import { CanvasImage } from './CanvasImage';
import { ResilientImage } from './ResilientImage';
import { RichMarkdown } from './RichMarkdown';
import { cleanQuestionTexts, extractQuestionImages } from '../../lib/exam/question-helpers';

export { cleanQuestionTexts, extractQuestionImages };

export interface ModuleQuestionVerification {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer?: unknown;
}

export interface ModuleQuestionContent {
  context_text?: string;
  question_text: string;
  question_image?: string;
  question_image_2?: string;
  question_image_3?: string;
  question_image_a?: string;
  question_image_b?: string;
  question_image_o?: string;
  question_images?: string[];
  resolved_image_url?: string;
  resolved_image_urls?: string[];
  image_url?: string;
  environment_text?: string;
  environment_images?: string[];
  options: Record<string, unknown> | unknown[];
}

interface ModuleQuestionProps {
  question: {
    id: string;
    content: ModuleQuestionContent;
  };
  selectedAnswer: string | null;
  onAnswer: (optionId: string) => void;
  isSplitLayout?: boolean;
  verification?: ModuleQuestionVerification;
}

interface NormalizedOption {
  id: string;
  text?: string;
  image_url?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isImageUrl(url: string): boolean {
  return url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:');
}

interface QuestionBodyProps {
  displayContext?: string;
  displayQuestion: string;
  primaryImage?: string;
  secondaryImages: string[];
  allImages: string[];
}

function QuestionBody({
  displayContext,
  displayQuestion,
  primaryImage,
  secondaryImages,
  allImages,
}: QuestionBodyProps) {
  if (displayContext) {
    return (
      <>
        <div className="prose prose-zinc max-w-none text-[15px] font-normal text-[#18181B] prose-headings:font-semibold prose-headings:text-[#18181B] prose-p:leading-[1.65] prose-li:text-[#18181B] prose-strong:text-[#18181B] mb-4">
          <RichMarkdown content={displayContext} />
        </div>

        {primaryImage && (
          <div className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl mb-4">
            {isImageUrl(primaryImage) ? (
              <CanvasImage src={primaryImage} alt="Question graphic" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl">
                [Image placeholder]
              </div>
            )}
          </div>
        )}

        {displayQuestion && (
          <div className="prose prose-zinc max-w-none text-[15px] font-normal text-[#18181B] prose-headings:font-semibold prose-headings:text-[#18181B] prose-p:leading-[1.65] prose-li:text-[#18181B] prose-strong:text-[#18181B] mb-4">
            <RichMarkdown content={displayQuestion} />
          </div>
        )}

        {secondaryImages.map((img, idx) => (
          <div key={idx} className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl mb-4">
            {isImageUrl(img) ? (
              <CanvasImage src={img} alt={`Question graphic ${idx + 2}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl">
                [Image placeholder]
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {displayQuestion && (
        <div className="prose prose-zinc max-w-none text-[15px] font-normal text-[#18181B] prose-headings:font-semibold prose-headings:text-[#18181B] prose-p:leading-[1.65] prose-li:text-[#18181B] prose-strong:text-[#18181B] mb-4">
          <RichMarkdown content={displayQuestion} />
        </div>
      )}

      {allImages.map((img, idx) => (
        <div key={idx} className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl mb-4">
          {isImageUrl(img) ? (
            <CanvasImage src={img} alt={`Question graphic ${idx + 1}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl">
              [Image placeholder]
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function normalizeOptions(options: Record<string, unknown> | unknown[]): NormalizedOption[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt, idx) => {
      if (typeof opt === 'string') {
        return { id: opt, text: opt };
      }
      if (isRecord(opt)) {
        const text = typeof opt.text === 'string' ? opt.text : undefined;
        const rawImg = opt.image_url ?? opt.image;
        const image_url = typeof rawImg === 'string' ? rawImg : undefined;
        const id = typeof opt.id === 'string' ? opt.id : `opt-${idx}`;
        return { id, text, image_url };
      }
      return { id: `opt-${idx}` };
    });
  }
  if (typeof options === 'object') {
    return Object.entries(options).map(([key, val]) => {
      if (typeof val === 'string') {
        return { id: key, text: val };
      }
      if (isRecord(val)) {
        const text = typeof val.text === 'string' ? val.text : undefined;
        const rawImg = val.image_url ?? val.image;
        const image_url = typeof rawImg === 'string' ? rawImg : undefined;
        return { id: key, text, image_url };
      }
      return { id: key };
    });
  }
  return [];
}

export default function ModuleQuestion({
  question,
  selectedAnswer,
  onAnswer,
  isSplitLayout = false,
  verification,
}: ModuleQuestionProps) {
  const { question_text, context_text, environment_text, environment_images, options } = question.content;
  const normalized = normalizeOptions(options);

  const allImages = extractQuestionImages(question.content as unknown as Record<string, unknown>);
  const primaryImage = allImages[0];
  const secondaryImages = allImages.slice(1);

  const { context: displayContext, question: displayQuestion } = cleanQuestionTexts(context_text, question_text);

  const isVerified = Boolean(verification?.isVerified);
  const correctAnswer = verification?.correctAnswer;

  if (isSplitLayout) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full h-full min-h-0">
        {/* Left column: Situation/Environment + Question */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 lg:h-full lg:overflow-y-auto pr-2 custom-scrollbar box-border pb-12 lg:pb-0 min-h-0">
          {/* Environment/Scheme Section (if present) */}
          {(environment_text || (environment_images && environment_images.length > 0)) && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 shadow-sm flex flex-col flex-none min-h-0">
              <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3 flex-none">
                📋 Situation / Environment
              </h3>
              {environment_images && environment_images.length > 0 && (
                <div className="mt-2 flex flex-col gap-4 flex-none">
                  {environment_images.map((img, idx) => (
                    <div key={idx} className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl">
                      {isImageUrl(img) ? (
                        <CanvasImage src={img} alt={`Environment ${idx + 1}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-blue-200 rounded-xl">
                          [Image placeholder]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {environment_text && (
                <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none flex-none mb-3">
                  <p>{environment_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Question */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex-none">
              Question
            </h3>
            <QuestionBody
              displayContext={displayContext}
              displayQuestion={displayQuestion}
              primaryImage={primaryImage}
              secondaryImages={secondaryImages}
              allImages={allImages}
            />
          </div>
        </div>

        {/* Right column: Options */}
        <div className="w-full lg:w-1/2 flex flex-col lg:h-full lg:overflow-y-auto pr-2 custom-scrollbar box-border pb-24 lg:pb-0 min-h-0">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Select your answer
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {normalized.map((option, idx) => {
              const isSelected = selectedAnswer === option.id;
              const letter = option.id.length === 1 ? option.id : String.fromCharCode(65 + idx);
              const hasImage = !!option.image_url;

              const isOptionCorrect =
                isVerified &&
                correctAnswer !== undefined &&
                (String(option.id).trim().toUpperCase() === String(correctAnswer).trim().toUpperCase() ||
                  letter.trim().toUpperCase() === String(correctAnswer).trim().toUpperCase());
              const isOptionWrong = isVerified && isSelected && !isOptionCorrect;

              let buttonClass = 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm';
              let badgeClass = 'bg-gray-100 text-gray-600';

              if (isVerified) {
                if (isOptionCorrect) {
                  buttonClass = 'border-emerald-500 bg-emerald-50/80 shadow-md shadow-emerald-100/50 cursor-default';
                  badgeClass = 'bg-emerald-600 text-white';
                } else if (isOptionWrong) {
                  buttonClass = 'border-rose-500 bg-rose-50/80 shadow-md shadow-rose-100/50 cursor-default';
                  badgeClass = 'bg-rose-500 text-white';
                } else {
                  buttonClass = 'border-gray-200 bg-gray-50/50 opacity-60 cursor-default';
                  badgeClass = 'bg-gray-100 text-gray-400';
                }
              } else if (isSelected) {
                buttonClass = 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100';
                badgeClass = 'bg-orange-500 text-white';
              }

              return (
                <button
                  key={option.id}
                  disabled={isVerified}
                  onClick={() => !isVerified && onAnswer(option.id)}
                  className={`
                    w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left
                    transition-all duration-200
                    ${buttonClass}
                  `}
                >
                  {/* Letter marker */}
                  <div
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                      transition-colors duration-200
                      ${badgeClass}
                    `}
                  >
                    {letter}
                  </div>

                  {/* Option content - render image if present, otherwise text */}
                  <div className="flex-1">
                    {hasImage ? (
                      <div className="min-h-[60px] flex items-center justify-center">
                        <ResilientImage
                          src={option.image_url}
                          alt={`Option ${letter}`}
                          className="max-h-24 object-contain"
                        />
                      </div>
                    ) : option.text ? (
                      <div className={`prose prose-sm prose-orange max-w-none prose-p:my-0 text-inherit ${
                        isOptionCorrect
                          ? 'text-emerald-950 font-medium'
                          : isOptionWrong
                          ? 'text-rose-950 font-medium'
                          : isSelected
                          ? 'text-orange-950 font-medium'
                          : 'text-gray-700'
                      }`}>
                        <RichMarkdown content={option.text} />
                      </div>
                    ) : null}
                  </div>

                  {/* Indicator */}
                  {isVerified ? (
                    isOptionCorrect ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isOptionWrong ? (
                      <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : null
                  ) : isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Environment/Scheme Section (if present) */}
      {(environment_text || (environment_images && environment_images.length > 0)) && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
          <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">
            📋 Situation / Environment
          </h3>
          {environment_text && (
            <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
              <p>{environment_text}</p>
            </div>
          )}
          {environment_images && environment_images.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {environment_images.map((img, idx) => (
                <div key={idx} className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl">
                  {isImageUrl(img) ? (
                    <CanvasImage src={img} alt={`Environment ${idx + 1}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-blue-200 rounded-xl">
                      [Image placeholder]
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
          Question
        </h3>
        <QuestionBody
          displayContext={displayContext}
          displayQuestion={displayQuestion}
          primaryImage={primaryImage}
          secondaryImages={secondaryImages}
          allImages={allImages}
        />
      </div>

      {/* Answer Options */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
          Select your answer
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {normalized.map((option, idx) => {
            const isSelected = selectedAnswer === option.id;
            const letter = option.id.length === 1 ? option.id : String.fromCharCode(65 + idx);
            const hasImage = !!option.image_url;

            const isOptionCorrect =
              isVerified &&
              correctAnswer !== undefined &&
              (String(option.id).trim().toUpperCase() === String(correctAnswer).trim().toUpperCase() ||
                letter.trim().toUpperCase() === String(correctAnswer).trim().toUpperCase());
            const isOptionWrong = isVerified && isSelected && !isOptionCorrect;

            let buttonClass = 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm';
            let badgeClass = 'bg-gray-100 text-gray-600';

            if (isVerified) {
              if (isOptionCorrect) {
                buttonClass = 'border-emerald-500 bg-emerald-50/80 shadow-md shadow-emerald-100/50 cursor-default';
                badgeClass = 'bg-emerald-600 text-white';
              } else if (isOptionWrong) {
                buttonClass = 'border-rose-500 bg-rose-50/80 shadow-md shadow-rose-100/50 cursor-default';
                badgeClass = 'bg-rose-500 text-white';
              } else {
                buttonClass = 'border-gray-200 bg-gray-50/50 opacity-60 cursor-default';
                badgeClass = 'bg-gray-100 text-gray-400';
              }
            } else if (isSelected) {
              buttonClass = 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100';
              badgeClass = 'bg-orange-500 text-white';
            }

            return (
              <button
                key={option.id}
                disabled={isVerified}
                onClick={() => !isVerified && onAnswer(option.id)}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left
                  transition-all duration-200
                  ${buttonClass}
                `}
              >
                {/* Letter marker */}
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                    transition-colors duration-200
                    ${badgeClass}
                  `}
                >
                  {letter}
                </div>

                {/* Option content - render image if present, otherwise text */}
                <div className="flex-1">
                  {hasImage ? (
                    <div className="min-h-[60px] flex items-center justify-center">
                      <ResilientImage
                        src={option.image_url}
                        alt={`Option ${letter}`}
                        className="max-h-24 object-contain"
                      />
                    </div>
                  ) : option.text ? (
                    <div className={`prose prose-sm prose-orange max-w-none prose-p:my-0 text-inherit ${
                      isOptionCorrect
                        ? 'text-emerald-950 font-medium'
                        : isOptionWrong
                        ? 'text-rose-950 font-medium'
                        : isSelected
                        ? 'text-orange-950 font-medium'
                        : 'text-gray-700'
                    }`}>
                      <RichMarkdown content={option.text} />
                    </div>
                  ) : null}
                </div>

                {/* Indicator */}
                {isVerified ? (
                  isOptionCorrect ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : isOptionWrong ? (
                    <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  ) : null
                ) : isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  );
}
