'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ZoomableImage } from './ZoomableImage';

export interface ModuleQuestion {
  id: string;
  content: {
    question_text: string;
    options: Record<string, string>;
  };
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

function prepareLatex(text: any) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$') // inline: \( ... \) to $...$
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$'); // block: \[ ... \] to $$...$$
}

function normalizeOptions(options: any): { id: string; text: string }[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { id: opt, text: opt };
      }
      return {
        id: opt.id || '',
        text: opt.text || '',
      };
    });
  }
  if (typeof options === 'object') {
    return Object.entries(options).map(([key, val]) => ({
      id: key,
      text: typeof val === 'string' ? val : (val as any)?.text || '',
    }));
  }
  return [];
}

export default function ModuleMCQ({
  passage,
  selectedAnswers,
  onAnswer,
}: ModuleMCQProps) {
  // State to track which question accordion is open. Default first one open.
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(
    passage.questions && passage.questions.length > 0 ? passage.questions[0].id : null
  );
  
  // State to track if passage is collapsed on mobile
  const [isPassageCollapsed, setIsPassageCollapsed] = useState(false);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestionId((prev) => (prev === questionId ? null : questionId));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">
      {/* Left side: Passage */}
      <div className="w-full lg:w-1/2 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden lg:h-[calc(100vh-180px)] h-auto box-border">
        <div 
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setIsPassageCollapsed(!isPassageCollapsed);
            }
          }}
          className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between cursor-pointer lg:cursor-default select-none"
        >
          <h2 className="text-xl font-bold text-gray-900">{passage.title}</h2>
          <span className="lg:hidden text-xs font-semibold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
            {isPassageCollapsed ? 'Show Reference Info' : 'Hide Reference Info'}
          </span>
        </div>
        <div className={`p-6 overflow-y-auto flex-col gap-4 ${isPassageCollapsed ? 'hidden lg:flex' : 'flex'}`}>
          <div className="prose prose-orange max-w-none text-gray-800 prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {prepareLatex(passage.body_markdown)}
            </ReactMarkdown>
          </div>
          {passage.resolved_image_url && (
            <ZoomableImage src={passage.resolved_image_url} alt="Passage graphic" />
          )}
        </div>
      </div>

      {/* Right side: Questions */}
      <div className="w-full lg:w-1/2 flex flex-col gap-1 lg:h-[calc(100vh-180px)] h-auto overflow-y-auto pr-2 box-border">
        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Questions ({(passage.questions || []).length})
        </div>

        {(passage.questions || []).map((question, index) => {
          const isOpen = openQuestionId === question.id;
          const selectedOption = selectedAnswers[question.id] || null;
          const isAnswered = selectedOption !== null;

          return (
            <div
              key={question.id}
              className={`bg-white rounded-xl border transition-all duration-200 ${
                isOpen
                  ? 'border-orange-300 shadow-md ring-1 ring-orange-100'
                  : 'border-gray-200 shadow-sm hover:border-orange-200'
              }`}
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleQuestion(question.id)}
                className="w-full flex items-center justify-between px-5 py-2 text-left focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                      isAnswered
                        ? 'bg-green-100 text-green-700'
                        : isOpen
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-800 text-sm">
                    Question {index + 1}
                  </span>
                  {isAnswered && (
                    <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-medium ml-2">
                      Answered: {selectedOption}
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100/50">
                  <div className="prose prose-sm prose-orange max-w-none text-gray-800 mb-2 prose-p:leading-relaxed">
                    {/* Optional child question image */}
                    {(question.content as any).resolved_image_url && (
                      <ZoomableImage src={(question.content as any).resolved_image_url} alt="Question graphic" />
                    )}
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {prepareLatex(question.content.question_text)}
                    </ReactMarkdown>
                  </div>

                  <div className="space-y-2">
                    {normalizeOptions(question.content.options).map((option, idx) => {
                        const isSelected = selectedOption === option.id;
                        const letter = option.id.length === 1 ? option.id : String.fromCharCode(65 + idx);

                        return (
                          <div
                            key={option.id}
                            onClick={() => onAnswer(question.id, option.id)}
                            className={`
                              flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200
                              ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-200'
                                  : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                              }
                            `}
                          >
                            <div
                              className={`
                                flex mt-0.5 shrink-0 items-center justify-center w-5 h-5 rounded-full border-2 transition-colors
                                ${
                                  isSelected
                                    ? 'border-orange-500 bg-orange-500 text-white'
                                    : 'border-gray-300'
                                }
                              `}
                            >
                              <span
                                className={`text-[10px] font-bold ${
                                  isSelected ? 'opacity-100' : 'opacity-0'
                                }`}
                              >
                                ✓
                              </span>
                            </div>
                            <div className="flex-1 flex items-center gap-3 w-full text-gray-700">
                              <span className="font-bold text-gray-900 mt-px w-4 shrink-0">
                                {letter}
                              </span>
                              <div className="prose prose-sm prose-orange max-w-none flex-1 prose-p:my-0">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {prepareLatex(option.text)}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
