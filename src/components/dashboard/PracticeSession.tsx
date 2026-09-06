'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Smile, Meh, Frown } from 'lucide-react';
import { KniButton } from '@/components/KniPrimitives';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import { questionRendererFactory, QuestionData } from '@/lib/exam/renderer';
import { usePracticeStore } from '@/lib/store/practice-store';

interface PracticeQuestion {
  id: string;
  section_id?: string;
  content?: unknown;
  isPassage?: boolean;
  questions?: PracticeQuestion[];
  [key: string]: unknown;
}

interface PracticeSessionProps {
  subtestType: string;
  subtestTitle: string;
  folderId: 'easy' | 'medium' | 'hard' | 'unclassified';
  questions: PracticeQuestion[];
  userId: string;
  userEmail: string;
  userFullName?: string | null;
  onExit: () => void;
  onQuestionRated: () => void;
  isPaper?: boolean;
  isPracticeOnly?: boolean;
}

const QUESTION_TIME_LIMITS: Record<string, number> = {
  figure_sequence: 75,
  completing_patterns: 75,
  math_equation: 75,
  latin_square: 90,
  solving_quantitative: 120,
  inferring_relationships: 27,
  numerical_series: 68,
  interpreting_texts: 122,
  representation_systems: 150,
  linguistic_structures: 136,
  sc_1: 163,
  sc_2: 231,
  econ_1: 163,
  econ_2: 231,
  eng_1: 163,
  eng_2_2d: 122,
  eng_2_3d: 122,
  eng_3: 163,
};

export default function PracticeSession({
  subtestType,
  subtestTitle,
  folderId,
  questions,
  userId,
  userEmail,
  userFullName,
  onExit,
  onQuestionRated,
}: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [ratingMap, setRatingMap] = useState<Record<string, 'easy' | 'medium' | 'hard'>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(
    QUESTION_TIME_LIMITS[subtestType] || 90
  );
  const [timerActive, setTimerActive] = useState<boolean>(true);

  const currentItem = questions[currentIndex] || null;
  // Mirror answers for navigation handlers without closing over stale state.
  const answersRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const resetTimerForQuestion = useCallback(() => {
    setTimeRemaining(QUESTION_TIME_LIMITS[subtestType] || 90);
    setTimerActive(true);
  }, [subtestType]);

  const handleGoToQuestion = useCallback((newIndex: number) => {
    const nextItem = questions[newIndex];
    setCurrentIndex(newIndex);
    setUserAnswer(nextItem ? (answersRef.current[nextItem.id] ?? null) : null);
    resetTimerForQuestion();
  }, [questions, resetTimerForQuestion]);

  // Timer resets in handleGoToQuestion (event handler); initial mount uses
  // the useState initializer above, so no reset effect is needed here.

  // Single interval for the countdown — previously recreated every tick via
  // [timerActive, timeRemaining] deps, which made back/forth feel sluggish.
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerActive]);

  const updateRating = usePracticeStore((state) => state.updateRating);

  const handleRatingSelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!currentItem || timeRemaining <= 0) return;

    const itemKey = currentItem.id;
    setRatingMap((prev) => ({ ...prev, [itemKey]: difficulty }));

    if (userId) {
      try {
        const questionIdsToSync = currentItem.isPassage && currentItem.questions
          ? currentItem.questions.map((childQ) => childQ.id)
          : [currentItem.id];

        await updateRating(questionIdsToSync, difficulty);
        onQuestionRated();
      } catch (err) {
        console.error('Failed to sync difficulty rating during practice:', err);
      }
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No practice items available.</p>
        <KniButton onClick={onExit} className="mt-4">Back to Practice</KniButton>
      </div>
    );
  }

  const isLastQuestion = currentIndex >= questions.length - 1;

  const qData: QuestionData = {
    id: currentItem.id,
    sectionId: currentItem.section_id || 'practice',
    sortOrder: 1,
    questionType: subtestType,
    content: currentItem.content || currentItem,
  };

  return (
    <>
      {/* <SecurityOverlay /> */}
      <WatermarkOverlay email={userEmail} fullName={userFullName} />
      <div className="h-full w-full flex-1 min-h-0 bg-background flex flex-col text-foreground select-none overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs">
        <header className="flex-none border-b border-border/40 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-3 sm:gap-4">
            <KniButton variant="ghost" onClick={onExit} className="size-8 p-0">
              <X className="w-5 h-5" />
            </KniButton>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-slate-900">{subtestTitle}</h2>
              <p className="text-xs text-muted-foreground capitalize">
                Folder: {folderId} • Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </header>

        {/* Question switcher: direct jump via question number (restored old UI) */}
        <div className="flex-none border-b border-border/40 bg-card/40 px-4 sm:px-6 py-2">
          <div className="flex gap-2 overflow-x-auto py-1 px-2">
            {questions.map((q, idx) => {
              const isActive = currentIndex === idx;
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null;
              const isRated = ratingMap[q.id] !== undefined;
              const btnClass = isActive
                ? 'bg-orange-500 border-orange-500 text-white font-extrabold shadow-sm scale-110 ring-2 ring-orange-200 ring-offset-1'
                : isAnswered || isRated
                  ? 'bg-orange-100/60 border-orange-200 text-orange-900 hover:bg-orange-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleGoToQuestion(idx)}
                  aria-label={`Go to question ${idx + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                  title={`Question ${idx + 1}${isAnswered ? ' (answered)' : ''}`}
                  className={`w-7 h-7 rounded-md border text-[11px] font-bold flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full flex flex-col gap-3 p-3 sm:p-4 overflow-hidden">
          <div key={currentItem.id} className="flex-1 min-h-0 overflow-y-auto rounded-xl">
            {questionRendererFactory.render(qData, {
              selectedAnswer: userAnswer,
              onAnswer: (val: unknown) => {
                if (timeRemaining > 0) {
                  setUserAnswer(val);
                  setAnswers((previous) => ({ ...previous, [currentItem.id]: val }));
                }
              },
            })}
          </div>

          <div className="flex-none flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 bg-background z-20">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-muted-foreground mr-1 sm:mr-2 font-medium">Difficulty Rating:</span>
              <KniButton
                variant={ratingMap[currentItem.id] === 'easy' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('easy')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs px-2.5 py-1.5"
              >
                <Smile className="w-3.5 h-3.5" /> Easy
              </KniButton>
              <KniButton
                variant={ratingMap[currentItem.id] === 'medium' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('medium')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs px-2.5 py-1.5"
              >
                <Meh className="w-3.5 h-3.5" /> Medium
              </KniButton>
              <KniButton
                variant={ratingMap[currentItem.id] === 'hard' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('hard')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs px-2.5 py-1.5"
              >
                <Frown className="w-3.5 h-3.5" /> Hard
              </KniButton>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <KniButton
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => handleGoToQuestion(Math.max(0, currentIndex - 1))}
                className="gap-1.5 px-3 py-1.5 text-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </KniButton>

              <KniButton
                onClick={() => {
                  if (isLastQuestion) {
                    onExit();
                  } else {
                    handleGoToQuestion(currentIndex + 1);
                  }
                }}
                className="gap-1.5 px-3 py-1.5 text-xs"
              >
                {isLastQuestion ? 'Finish Practice' : 'Next'} <ChevronRight className="w-4 h-4" />
              </KniButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
