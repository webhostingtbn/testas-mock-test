'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CanvasImage } from './CanvasImage';
import { RichMarkdown } from './RichMarkdown';

export interface ModuleQuestionContent {
  question_text: string;
  options: Record<string, unknown>;
  resolved_image_url?: string;
}

export interface ModuleQuestion {
  id: string;
  sort_order?: number;
  content: ModuleQuestionContent;
}

export interface ModulePassage {
  id: string;
  title: string;
  body_markdown: string;
  image_url?: string;
  resolved_image_url?: string;
  questions: ModuleQuestion[];
}

interface ModuleMCQProps {
  passage: ModulePassage;
  selectedAnswers: Record<string, string>; // Maps questionId -> selected letter ('A', 'B', etc.)
  onAnswer: (questionId: string, answer: string) => void;
}

interface NormalizedOption {
  id: string;
  text: string;
  image_url?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOptionImage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value['image_url'] ?? value['image'];
  return typeof raw === 'string' ? raw : undefined;
}

function getOptionText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value['text'] === 'string') return value['text'];
  return '';
}

function normalizeOptions(options: Record<string, unknown> | Array<unknown>): NormalizedOption[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt, idx): NormalizedOption => {
      if (typeof opt === 'string') return { id: opt, text: opt };
      if (isRecord(opt)) {
        const text = typeof opt['text'] === 'string' ? opt['text'] : '';
        const image_url = getOptionImage(opt);
        const id = typeof opt['id'] === 'string' ? opt['id'] : `opt-${idx}`;
        return { id, text, image_url };
      }
      return { id: `opt-${idx}`, text: '' };
    });
  }
  return Object.entries(options).map(([key, val], idx): NormalizedOption => {
    if (typeof val === 'string') return { id: key, text: val };
    if (isRecord(val)) {
      return {
        id: key,
        text: getOptionText(val),
        image_url: getOptionImage(val),
      };
    }
    return { id: key || `opt-${idx}`, text: '' };
  });
}

export default function ModuleMCQ({
  passage,
  selectedAnswers,
  onAnswer,
}: ModuleMCQProps) {
  // State to track which question accordion is open. Default first one open.
  // Parents pass key={passage.id} so navigating remounts and resets this.
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(
    passage.questions && passage.questions.length > 0 ? passage.questions[0].id : null
  );

  // State to track if passage is collapsed on mobile
  const [isPassageCollapsed, setIsPassageCollapsed] = useState(false);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestionId((prev) => (prev === questionId ? null : questionId));
  };

  return (
    <div className="flex flex-col lg:flex-row items-stretch h-auto lg:h-full w-full min-h-0 lg:divide-x lg:divide-[#E5E7EB]">
      {/* Stacked (mobile): h-auto so panes size to content instead of shrinking
          and overflowing through each other. Split (desktop): h-full with
          independent pane scrolling. */}
      {/* Left pane: Passage — flat, no nested card. Hairline divider separates panes on desktop. */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-0 lg:h-full lg:pr-3">
        <div
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setIsPassageCollapsed(!isPassageCollapsed);
            }
          }}
          className="flex-none flex items-center justify-between gap-3 py-3 cursor-pointer lg:cursor-default select-none"
        >
          <h2 className="text-[18px] font-semibold text-[#18181B] leading-tight">{passage.title}</h2>
          <span className="lg:hidden shrink-0 text-[13px] font-medium px-3 py-1 bg-[#F3F4F6] text-[#71717A] rounded-full">
            {isPassageCollapsed ? 'Show reference' : 'Hide reference'}
          </span>
        </div>
        <div className={`flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar lg:pb-6 flex-col gap-4 ${isPassageCollapsed ? 'hidden lg:flex' : 'flex'}`}>
          {passage.body_markdown.trim().length > 0 ? (
            <>
              <p className="text-[13px] italic text-[#71717A] leading-relaxed">
                Read the text below and choose the correct answer
              </p>
              <div className="prose prose-zinc max-w-none text-[15px] font-normal text-[#18181B] prose-headings:font-semibold prose-headings:text-[#18181B] prose-p:leading-[1.65] prose-li:text-[#18181B] prose-strong:text-[#18181B]">
                <RichMarkdown content={passage.body_markdown} />
              </div>
            </>
          ) : (
            <p className="text-[13px] italic text-[#71717A] leading-relaxed">
              No additional reference text for this question.
            </p>
          )}
          {passage.resolved_image_url && (
            <div className="w-full h-[320px] sm:h-[380px] shrink-0 overflow-hidden rounded-xl">
              <CanvasImage src={passage.resolved_image_url} alt="Passage graphic" />
            </div>
          )}
        </div>
      </div>

      {/* Right pane: Questions — grouped by whitespace, options are the only bordered cards.
          On stacked (mobile) layout a hairline + spacing separates it from the passage. */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-0 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pl-6 pt-6 pb-8 mt-2 border-t border-[#E5E7EB] lg:border-t-0 lg:mt-0">
        <div className="text-[13px] font-medium text-[#71717A] mb-4">
          Select the right option
        </div>

        <div className="flex flex-col gap-5">
        {(passage.questions || []).map((question, index) => {
          const isOpen = openQuestionId === question.id;
          const selectedOption = selectedAnswers[question.id] || null;
          const isAnswered = selectedOption !== null;
          const questionNo = question.sort_order ?? (index + 1);

          return (
            <section
              key={question.id}
              className="border-b border-[#E5E7EB] pb-5 last:border-b-0 last:pb-0"
            >
              {/* Question header row — accordion toggle keeps multi-question passages compact */}
              <button
                type="button"
                onClick={() => toggleQuestion(question.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 rounded-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 transition-colors ${
                      isAnswered
                        ? 'bg-[#18181B] text-white'
                        : isOpen
                        ? 'bg-[#FFF7ED] text-[#EA580C] border border-orange-200'
                        : 'bg-[#F4F4F5] text-[#71717A]'
                    }`}
                  >
                    {questionNo}
                  </div>
                  <span className="font-semibold text-[#18181B] text-[15px] truncate">
                    Question {questionNo}
                  </span>
                  {isAnswered && (
                    <span className="text-[12px] bg-[#F4F4F5] text-[#71717A] border border-[#E5E7EB] px-2 py-0.5 rounded-full font-medium ml-1 shrink-0">
                      {selectedOption}
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                )}
              </button>

              {/* Question body */}
              {isOpen && (
                <div className="pt-3">
                  {question.content.resolved_image_url && (
                    <div className="w-full h-[280px] sm:h-[320px] shrink-0 overflow-hidden rounded-xl mb-4">
                      <CanvasImage src={question.content.resolved_image_url} alt="Question graphic" />
                    </div>
                  )}
                  <div className="prose prose-zinc max-w-none text-[15px] font-normal text-[#18181B] prose-headings:font-semibold prose-headings:text-[#18181B] prose-p:leading-[1.65] prose-li:text-[#18181B] prose-strong:text-[#18181B] mb-4">
                    <RichMarkdown content={question.content.question_text} />
                  </div>

                  <div className="flex flex-col gap-[10px]" role="radiogroup" aria-label={`Question ${questionNo} options`}>
                    {normalizeOptions(question.content.options).map((option, idx) => {
                        const isSelected = selectedOption === option.id;
                        const letter = option.id.length === 1 ? option.id : String.fromCharCode(65 + idx);
                        const hasImage = !!option.image_url;

                        return (
                          <div
                            key={option.id}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onClick={() => onAnswer(question.id, option.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onAnswer(question.id, option.id);
                              }
                            }}
                            className={`flex items-center gap-3 rounded-[10px] border px-[18px] py-[14px] min-h-[48px] cursor-pointer outline-none transition-colors text-[14px] leading-[1.5] focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 ${
                              isSelected
                                ? 'border-[#EA580C]/40 bg-[#FFF7ED]/60 text-[#18181B]'
                                : 'border-[#E5E7EB] bg-white text-[#18181B] hover:border-[#D1D5DB] hover:bg-[#FAFAFA]'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                                isSelected
                                  ? 'border-[#EA580C]'
                                  : 'border-[#D1D5DB] bg-white'
                              }`}
                            >
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                              )}
                            </span>
                            <span className="font-medium text-[#18181B] shrink-0">
                              {letter}
                            </span>
                            <span aria-hidden="true" className="text-[#D1D5DB] shrink-0">—</span>
                            {hasImage && option.image_url ? (
                              <span className="flex-1 min-h-[60px] flex items-center justify-center">
                                <img
                                  src={option.image_url}
                                  alt={`Option ${letter}`}
                                  className="max-h-24 object-contain"
                                />
                              </span>
                            ) : (
                              <span className="flex-1 min-w-0 prose prose-sm prose-zinc max-w-none prose-p:my-0 prose-li:text-[#18181B] prose-strong:text-[#18181B]">
                                <RichMarkdown content={option.text} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}
