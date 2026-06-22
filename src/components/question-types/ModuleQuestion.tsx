'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ZoomableImage } from './ZoomableImage';

interface ModuleQuestionProps {
  question: {
    id: string;
    content: {
      question_text: string;
      question_image?: string;
      environment_text?: string;
      environment_images?: string[];
      options: any;
    };
  };
  selectedAnswer: string | null;
  onAnswer: (optionId: string) => void;
}

function prepareLatex(text: any) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$') // inline: \( ... \) to $...$
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$'); // block: \[ ... \] to $$...$$
}

function normalizeOptions(options: any): { id: string; text?: string; image?: string }[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { id: opt, text: opt };
      }
      return {
        id: opt.id || '',
        text: opt.text || '',
        image: opt.image,
      };
    });
  }
  if (typeof options === 'object') {
    return Object.entries(options).map(([key, val]) => {
      if (typeof val === 'string') {
        return { id: key, text: val };
      }
      return {
        id: key,
        text: (val as any)?.text || '',
        image: (val as any)?.image,
      };
    });
  }
  return [];
}

export default function ModuleQuestion({
  question,
  selectedAnswer,
  onAnswer,
}: ModuleQuestionProps) {
  const { question_text, question_image, environment_text, environment_images, options } = question.content;
  const normalized = normalizeOptions(options);

  return (
    <div className="space-y-6">
      {/* Environment/Scheme Section (if present) */}
      {(environment_text || environment_images) && (
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
                <div key={idx} className="w-full">
                  {img.startsWith('http') || img.startsWith('/') ? (
                    <ZoomableImage src={img} alt={`Environment ${idx + 1}`} />
                  ) : (
                    <div className="w-48 h-32 flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-blue-250 rounded-xl">
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
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Question
        </h3>
        <p className="text-gray-800 text-base leading-relaxed mb-4">
          {question_text}
        </p>
        {question_image && (
          <div className="w-full">
            {question_image.startsWith('http') || question_image.startsWith('/') ? (
              <ZoomableImage src={question_image} alt="Question" />
            ) : (
              <div className="w-64 h-40 flex items-center justify-center text-sm text-gray-400 bg-gray-50 border border-gray-250 rounded-xl">
                [Image placeholder]
              </div>
            )}
          </div>
        )}
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

            return (
              <button
                key={option.id}
                onClick={() => onAnswer(option.id)}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left
                  transition-all duration-200
                  ${
                    isSelected
                      ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                {/* Letter marker */}
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                    transition-colors duration-205
                    ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }
                  `}
                >
                  {letter}
                </div>

                {/* Option content */}
                <div className="flex-1">
                  {option.text && (
                    <div className={`prose prose-sm prose-orange max-w-none prose-p:my-0 text-inherit ${
                      isSelected ? 'text-orange-950 font-medium' : 'text-gray-700'
                    }`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {prepareLatex(option.text)}
                      </ReactMarkdown>
                    </div>
                  )}
                  {option.image && (
                    <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 inline-block">
                      {option.image.startsWith('http') || option.image.startsWith('/') ? (
                        <img src={option.image} alt={`Option ${letter}`} className="max-h-32 object-contain" />
                      ) : (
                        <div className="w-32 h-20 flex items-center justify-center text-xs text-gray-400">
                          [Image]
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
