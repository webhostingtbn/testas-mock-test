'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Smile,
  Meh,
  Frown,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';
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

type Difficulty = 'easy' | 'medium' | 'hard';

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

const RATING_OPTIONS: Array<{ id: Difficulty; label: string; Icon: typeof Smile }> = [
  { id: 'easy', label: 'Easy', Icon: Smile },
  { id: 'medium', label: 'Medium', Icon: Meh },
  { id: 'hard', label: 'Hard', Icon: Frown },
];

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
  const [ratingMap, setRatingMap] = useState<Record<string, Difficulty>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(
    QUESTION_TIME_LIMITS[subtestType] || 90
  );
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [timerHidden, setTimerHidden] = useState<boolean>(false);
  const [navigatorOpen, setNavigatorOpen] = useState<boolean>(false);
  const navigatorRef = useRef<HTMLDivElement>(null);

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
    setNavigatorOpen(false);
    resetTimerForQuestion();
  }, [questions, resetTimerForQuestion]);

  // Close the navigator dropdown on outside click / Escape.
  useEffect(() => {
    if (!navigatorOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (navigatorRef.current && !navigatorRef.current.contains(e.target as Node)) {
        setNavigatorOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavigatorOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigatorOpen]);

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

  const handleRatingSelect = async (difficulty: Difficulty) => {
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
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null;
  }).length;

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
      {/* Flat session view — no outer card. The view sits directly on the
          page background; header/footer hairlines provide the structure. */}
      <div className="h-full w-full flex-1 min-h-0 flex flex-col text-[#18181B] select-none overflow-hidden">
        {/* Top utility header (64px): title + timer pill.
            No exit button here — the dashboard shell's back navigation
            ("Back to Folders") is the single exit path. */}
        <header className="flex-none pb-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-[18px] leading-tight text-[#18181B] truncate">{subtestTitle}</h2>
            <p className="text-[13px] text-[#71717A] capitalize truncate">
              Folder: {folderId} • {answeredCount}/{questions.length} answered
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-lg pl-4 pr-2 py-1.5">
              <span className="font-mono text-sm font-medium text-[#18181B] tabular-nums min-w-11 text-center">
                {timerHidden ? '••:••' : formatTime(timeRemaining)}
              </span>
              <button
                type="button"
                onClick={() => setTimerHidden((v) => !v)}
                aria-label={timerHidden ? 'Show timer' : 'Hide timer'}
                title={timerHidden ? 'Show timer' : 'Hide timer'}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-white transition-colors"
              >
                {timerHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Split workspace */}
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          <div key={currentItem.id} className="h-full min-h-0 overflow-y-auto custom-scrollbar">
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
        </div>

        {/* Bottom dock (64px): help • navigator pill • rating + Back/Next */}
        <footer className="flex-none min-h-16 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* <button
              type="button"
              title="Help"
              aria-label="Help"
              className="w-9 h-9 rounded-full border border-[#E5E7EB] hidden sm:flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:border-[#D1D5DB] transition-colors shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
            </button> */}
            <span className="hidden md:inline text-[13px] font-medium text-[#71717A]">Rate:</span>
            <div className="flex items-center gap-1.5">
              {RATING_OPTIONS.map(({ id, label, Icon }) => {
                const isActive = ratingMap[currentItem.id] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void handleRatingSelect(id)}
                    disabled={timeRemaining <= 0}
                    aria-pressed={isActive}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                      isActive
                        ? 'bg-[#18181B] text-white border-[#18181B]'
                        : 'bg-white border-[#E5E7EB] text-[#71717A] hover:border-[#D1D5DB] hover:text-[#18181B]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question navigator pill with dropdown grid */}
          <div ref={navigatorRef} className="relative order-first w-full sm:order-none sm:w-auto flex justify-center">
            <button
              type="button"
              onClick={() => setNavigatorOpen((v) => !v)}
              aria-expanded={navigatorOpen}
              aria-haspopup="listbox"
              className="flex items-center gap-1.5 bg-[#F4F4F5] rounded-full px-4 py-2 text-[13px] font-medium text-[#18181B] hover:bg-[#ECECEE] transition-colors"
            >
              Question {currentIndex + 1} of {questions.length}
              <ChevronDown className={`w-3.5 h-3.5 text-[#71717A] transition-transform ${navigatorOpen ? 'rotate-180' : ''}`} />
            </button>
            {navigatorOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[min(420px,calc(100vw-3rem))] bg-white border border-[#E5E7EB] rounded-xl p-3 z-40">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-[13px] font-medium text-[#71717A]">
                    {answeredCount} of {questions.length} answered
                  </span>
                  <span className="flex items-center gap-3 text-[12px] text-[#71717A]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#18181B]" /> Answered
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full border border-[#D1D5DB]" /> Todo
                    </span>
                  </span>
                </div>
                <div role="listbox" aria-label="Questions" className="grid grid-cols-7 gap-1.5 max-h-[240px] overflow-y-auto custom-scrollbar">
                  {questions.map((q, idx) => {
                    const isActive = currentIndex === idx;
                    const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleGoToQuestion(idx)}
                        aria-label={`Go to question ${idx + 1}${isAnswered ? ' (answered)' : ''}`}
                        title={`Question ${idx + 1}${isAnswered ? ' (answered)' : ''}`}
                        className={`h-8 rounded-lg border text-[12px] font-semibold flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-[#18181B] border-[#18181B] text-white'
                            : isAnswered
                              ? 'bg-[#F4F4F5] border-[#E5E7EB] text-[#18181B] hover:border-[#D1D5DB]'
                              : 'bg-white border-[#E5E7EB] text-[#71717A] hover:border-[#D1D5DB] hover:text-[#18181B]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => handleGoToQuestion(Math.max(0, currentIndex - 1))}
              className="h-10 px-5 text-sm font-medium rounded-[10px] border border-[#E5E7EB] bg-white text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLastQuestion) {
                  onExit();
                } else {
                  handleGoToQuestion(currentIndex + 1);
                }
              }}
              className="h-10 px-6 text-sm font-medium rounded-[10px] bg-[#18181B] text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
            >
              {isLastQuestion ? 'Finish' : 'Next'}
              {!isLastQuestion && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
