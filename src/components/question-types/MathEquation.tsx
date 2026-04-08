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
    <div className="space-y-6" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Question label */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Solve the equations
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Equations */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Equations
          </h3>
          <div className="space-y-4">
            {equations.map((eq, idx) => (
              <div
                key={idx}
                className="bg-gray-50 rounded-xl px-5 py-4 text-center"
              >
                <span className="text-lg font-mono font-semibold text-gray-800">
                  {eq}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Middle column: Variable inputs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Your Answers
          </h3>
          <div className="space-y-3">
            {variables.map((variable) => {
              const isActive = activeVariable === variable;
              const value = answers[variable];

              return (
                <button
                  key={variable}
                  onClick={() => setActiveVariable(variable)}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left
                    transition-all duration-150
                    ${
                      isActive
                        ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100'
                        : value !== undefined
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }
                  `}
                >
                  <span className={`text-lg font-bold font-mono w-8 ${
                    isActive ? 'text-orange-600' : 'text-gray-700'
                  }`}>
                    {variable}
                  </span>
                  <span className="text-gray-400">=</span>
                  <div className={`flex-1 min-h-7 rounded-lg px-3 py-1 text-center text-xl font-bold font-mono ${
                    isActive
                      ? 'bg-white border border-orange-300 text-gray-900'
                      : 'bg-white/50 text-gray-700'
                  }`}>
                    {value !== undefined ? value : ''}
                    {isActive && (
                      <span className="inline-block w-0.5 h-5 bg-orange-500 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Virtual keyboard */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Scratchpad Calculator
          </h3>
          <VirtualKeyboard onKeyPress={handleKeyPress} />
        </div>
      </div>
    </div>
  );
}
