'use client';

import { useEffect, useState, useRef } from 'react';
import { useExamStore } from '@/lib/store/exam-store';
import { Button } from '@/components/ui/button';
import { Coffee, SkipForward, Timer } from 'lucide-react';

interface BreakScreenProps {
  onSkip: () => void;
  onComplete: () => void;
}

export default function BreakScreen({ onSkip, onComplete }: BreakScreenProps) {
  const { getBreakRemainingTime, breakDuration } = useExamStore();
  const [remaining, setRemaining] = useState(getBreakRemainingTime());
  const hasCompleted = useRef(false);

  useEffect(() => {
    hasCompleted.current = false;
  }, [breakDuration]);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = getBreakRemainingTime();
      setRemaining(time);

      if (time <= 0 && !hasCompleted.current) {
        hasCompleted.current = true;
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [getBreakRemainingTime, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const isLongBreak = breakDuration > 120;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="text-center max-w-md px-6">
        {/* Icon */}
        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg ${
          isLongBreak
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200'
            : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200'
        }`}>
          <Coffee className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isLongBreak ? 'Long Break' : 'Short Break'}
        </h1>
        <p className="text-gray-500 mb-8">
          {isLongBreak
            ? 'Take a 30-minute break before the module test. Relax and come back refreshed!'
            : 'Take a quick 2-minute break before the next section.'}
        </p>

        {/* Timer Display */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-3">
            <Timer className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide uppercase">Time Remaining</span>
          </div>
          <div className="text-6xl font-bold tabular-nums text-gray-900">
            {String(minutes).padStart(2, '0')}
            <span className="text-gray-300 animate-pulse">:</span>
            {String(seconds).padStart(2, '0')}
          </div>
        </div>

        {/* Skip button */}
        <Button
          onClick={onSkip}
          variant="outline"
          size="lg"
          className="h-12 px-8 text-sm font-medium border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-all duration-200"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip Break & Continue
        </Button>
      </div>
    </div>
  );
}
