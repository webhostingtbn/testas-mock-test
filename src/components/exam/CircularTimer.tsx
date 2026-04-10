'use client';

import { useEffect, useState, useRef } from 'react';
import { useExamStore } from '@/lib/store/exam-store';

interface CircularTimerProps {
  onTimeUp: () => void;
  size?: number;
}

export default function CircularTimer({ onTimeUp, size = 32 }: CircularTimerProps) {
  const { getRemainingTime, sectionDuration } = useExamStore();
  const [remaining, setRemaining] = useState(getRemainingTime());
  const hasCalledTimeUp = useRef(false);

  useEffect(() => {
    hasCalledTimeUp.current = false;
  }, [sectionDuration]);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = getRemainingTime();
      setRemaining(time);

      if (time <= 0 && !hasCalledTimeUp.current) {
        hasCalledTimeUp.current = true;
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [getRemainingTime, onTimeUp]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const progress = sectionDuration > 0 ? remaining / sectionDuration : 1;

  // SVG circle calculations
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Color changes as time runs low
  const isWarning = remaining <= 120; // 2 minutes
  const isCritical = remaining <= 30;  // 30 seconds
  const ringColor = isCritical
    ? '#EF4444'
    : isWarning
    ? '#F59E0B'
    : 'rgba(255, 255, 255, 0.9)';

  const textColor = isCritical
    ? '#FEE2E2'
    : 'white';

  return (
    <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className={`transform -rotate-90 ${isCritical ? 'animate-pulse' : ''}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
      </div>
      {/* Time text */}
      <span
        className="text-lg font-bold tabular-nums tracking-wider pr-1"
        style={{ color: textColor }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
