'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

export default function VirtualCalculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const handleDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const calculate = (a: number, b: number, op: string) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleOperator = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator);
      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForNewValue(true);
    setOperator(nextOperator);
  };

  const handleEqual = () => {
    if (operator && previousValue !== null) {
      const result = calculate(previousValue, parseFloat(display), operator);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };

  const handleDelete = () => {
    if (waitingForNewValue) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };

  const buttonClass = "h-12 text-lg font-medium shadow-sm transition-all focus:ring-2 focus:ring-orange-500 focus:outline-none";

  return (
    <div className="w-full flex flex-col gap-3 bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-inner">
      {/* Calculator Display */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-3 text-right shadow-sm flex flex-col justify-end h-16 relative">
        {(operator && previousValue !== null) && (
          <span className="absolute top-1 right-3 text-xs text-gray-400 font-mono">
            {previousValue} {operator}
          </span>
        )}
        <span className="text-2xl font-mono text-gray-800 tracking-wide truncate">
          {display}
        </span>
      </div>

      {/* Calculator Keypad */}
      <div className="grid grid-cols-4 gap-2">
        <Button onClick={handleClear} variant="outline" className={`${buttonClass} col-span-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200`}>
          Clear
        </Button>
        <Button onClick={handleDelete} variant="outline" className={`${buttonClass} text-gray-500 hover:bg-gray-100 p-0 flex items-center justify-center`}>
          <Delete className="w-5 h-5" />
        </Button>
        <Button onClick={() => handleOperator('÷')} variant="outline" className={`${buttonClass} bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200`}>
          ÷
        </Button>

        <Button onClick={() => handleDigit('7')} variant="outline" className={buttonClass}>7</Button>
        <Button onClick={() => handleDigit('8')} variant="outline" className={buttonClass}>8</Button>
        <Button onClick={() => handleDigit('9')} variant="outline" className={buttonClass}>9</Button>
        <Button onClick={() => handleOperator('×')} variant="outline" className={`${buttonClass} bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200`}>
          ×
        </Button>

        <Button onClick={() => handleDigit('4')} variant="outline" className={buttonClass}>4</Button>
        <Button onClick={() => handleDigit('5')} variant="outline" className={buttonClass}>5</Button>
        <Button onClick={() => handleDigit('6')} variant="outline" className={buttonClass}>6</Button>
        <Button onClick={() => handleOperator('-')} variant="outline" className={`${buttonClass} bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200`}>
          -
        </Button>

        <Button onClick={() => handleDigit('1')} variant="outline" className={buttonClass}>1</Button>
        <Button onClick={() => handleDigit('2')} variant="outline" className={buttonClass}>2</Button>
        <Button onClick={() => handleDigit('3')} variant="outline" className={buttonClass}>3</Button>
        <Button onClick={() => handleOperator('+')} variant="outline" className={`${buttonClass} bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200`}>
          +
        </Button>

        <Button onClick={() => handleDigit('0')} variant="outline" className={`${buttonClass} col-span-2`}>0</Button>
        <Button onClick={() => handleDigit('.')} variant="outline" className={buttonClass}>.</Button>
        <Button onClick={handleEqual} className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-600 shadow-md border-0`}>
          =
        </Button>
      </div>
    </div>
  );
}
