'use client';

import { useState, useCallback } from 'react';
// import VirtualCalculator from './VirtualCalculator';
import VirtualKeyboard from './VirtualKeyboard';

interface MathEquationProps {
  question: {
    id: string;
    content: {
      equations: string[];
      variables: string[];
    };
  };
  currentAnswer: Record<string, number> | null;
  onAnswer: (answer: Record<string, number>) => void;
}

export default function MathEquation({
  question,
  currentAnswer,
  onAnswer,
}: MathEquationProps) {
  const equations = question?.content?.equations || [];
  const variables = question?.content?.variables || [];
  const [activeVariable, setActiveVariable] = useState<string | null>(() => variables[0] || null);
  const answers = currentAnswer || {};

  const handleKeyPress = useCallback(
    (key: string) => {
      if (!activeVariable) return;

      const currentValue = answers[activeVariable];
      let newValue: number | undefined;

      if (key === 'delete') {
        if (currentValue !== undefined) {
          const str = String(currentValue);
          if (str.length <= 1) {
            // Remove the answer
            const newAnswers = { ...answers };
            delete newAnswers[activeVariable];
            onAnswer(newAnswers);
            return;
          }
          newValue = parseInt(str.slice(0, -1), 10);
          onAnswer({ ...answers, [activeVariable]: newValue });
        }
        return;
      }

      const digit = parseInt(key, 10);
      if (isNaN(digit)) return;

      if (currentValue !== undefined) {
        // Append digit (limit to 2 digits)
        const str = String(currentValue);
        if (str.length >= 2) return;
        newValue = parseInt(str + key, 10);
      } else {
        newValue = digit;
      }

      onAnswer({ ...answers, [activeVariable]: newValue });
    },
    [activeVariable, answers, onAnswer]
  );

  // handle physical keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleKeyPress('delete');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = variables.indexOf(activeVariable || '');
        const nextIdx = (currentIdx + 1) % variables.length;
        setActiveVariable(variables[nextIdx]);
      }
    },
    [handleKeyPress, activeVariable, variables]
  );

  return (
    <div className="flex flex-col h-full min-h-0" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Pane label */}
      <div className="flex-none pt-6 py-3">
        <p className="text-[13px] font-medium text-[#71717A]">Solve the equations</p>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:divide-x lg:divide-[#E5E7EB]">
        {/* Left pane: Equations — flat display rows, no nested card */}
        <div className="flex-1 min-w-0 pb-6 lg:py-6 pr-6">
          <p className="text-[13px] font-medium text-[#71717A] mb-4">Equations</p>
          <div className="flex flex-col gap-[10px]">
            {equations.map((eq, idx) => (
              <div
                key={idx}
                className="bg-[#F4F4F5] rounded-[10px] px-5 py-4 text-center"
              >
                <span className="text-lg font-mono font-semibold text-[#18181B]">
                  {eq}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Middle pane: Variable inputs */}
        <div className="flex-1 min-w-0 px-6 sm:px-8 pb-6 lg:py-6">
          <p className="text-[13px] font-medium text-[#71717A] mb-4">Your answers</p>
          <div className="flex flex-col gap-[10px]">
            {variables.map((variable) => {
              const isActive = activeVariable === variable;
              const value = answers[variable];

              return (
                <button
                  key={variable}
                  type="button"
                  onClick={() => setActiveVariable(variable)}
                  aria-pressed={isActive}
                  className={`
                    w-full flex items-center gap-4 px-[18px] py-3 rounded-[10px] border text-left
                    transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
                    ${
                      isActive
                        ? 'border-[#EA580C]/40 bg-[#FFF7ED]/60'
                        : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#FAFAFA]'
                    }
                  `}
                >
                  <span className={`text-lg font-bold font-mono w-8 shrink-0 ${
                    isActive ? 'text-[#EA580C]' : 'text-[#18181B]'
                  }`}>
                    {variable}
                  </span>
                  <span className="text-[#D1D5DB] shrink-0">=</span>
                  <span className={`flex-1 min-h-7 rounded-lg px-3 py-1 text-center text-xl font-bold font-mono ${
                    value !== undefined ? 'text-[#18181B]' : 'text-[#D1D5DB]'
                  }`}>
                    {value !== undefined ? value : '–'}
                    {isActive && (
                      <span className="inline-block w-0.5 h-5 bg-[#EA580C] animate-pulse ml-0.5 align-middle" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right pane: Virtual keyboard */}
        <div className="w-full lg:w-[280px] shrink-0 pl-6 pb-6 sm:pb-8 lg:py-6">
          <p className="text-[13px] font-medium text-[#71717A] mb-4">Keypad</p>
          <VirtualKeyboard onKeyPress={handleKeyPress} />
        </div>
      </div>
    </div>
  );
}
