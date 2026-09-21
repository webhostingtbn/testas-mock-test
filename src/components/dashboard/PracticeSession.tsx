'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { KniButton } from '@/components/KniPrimitives';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import { questionRendererFactory, QuestionData } from '@/lib/exam/renderer';
import { ImageService } from '@/lib/services/image-service';
import { usePracticeStore } from '@/lib/store/practice-store';

interface PracticeQuestion {
  id: string;
  section_id?: string;
  sort_order?: number;
  question_type?: string;
  content?: unknown;
  passage_id?: string | null;
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

const RATING_OPTIONS: Array<{ id: Difficulty; label: string; Icon: typeof Smile }> = [
  { id: 'easy', label: 'Easy', Icon: Smile },
  { id: 'medium', label: 'Medium', Icon: Meh },
  { id: 'hard', label: 'Hard', Icon: Frown },
];

export interface QuestionVerificationState {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer: unknown;
}

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
  const [verifications, setVerifications] = useState<Record<string, QuestionVerificationState>>({});
  const [isCheckingAnswer, setIsCheckingAnswer] = useState<boolean>(false);
  const userRatings = usePracticeStore((state) => state.userRatings);
  const [ratingMap, setRatingMap] = useState<Record<string, Difficulty>>(() => {
    const initial: Record<string, Difficulty> = {};
    for (const q of questions) {
      if (userRatings[q.id]) {
        initial[q.id] = userRatings[q.id];
      } else if (folderId === 'easy' || folderId === 'medium' || folderId === 'hard') {
        initial[q.id] = folderId;
      }
    }
    return initial;
  });
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [timerHidden, setTimerHidden] = useState<boolean>(false);
  const [navigatorOpen, setNavigatorOpen] = useState<boolean>(false);
  const navigatorRef = useRef<HTMLDivElement>(null);

  const currentItem = questions[currentIndex] || null;

  // Image URLs resolve lazily: only the current question (+ a prefetch of
  // the next) is signed, so opening a 50-question folder costs ~7 sign
  // requests instead of ~350. Resolved rows accumulate by id for the
  // lifetime of the session; the shared service cache dedupes repeats.
  const imageService = useMemo(() => new ImageService(), []);
  const [resolvedById, setResolvedById] = useState<Record<string, PracticeQuestion>>({});
  const requestedImageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const targets = [questions[currentIndex], questions[currentIndex + 1]];
    for (const target of targets) {
      if (!target || requestedImageIdsRef.current.has(target.id)) continue;
      requestedImageIdsRef.current.add(target.id);
      void imageService
        .resolveQuestionImageUrls([target])
        .then(([resolved]) => {
          if (resolved) {
            setResolvedById((prev) =>
              prev[target.id] ? prev : { ...prev, [target.id]: resolved },
            );
          }
        })
        .catch((err: unknown) => {
          // Render the raw row now (its images degrade to error tiles) but
          // allow a later navigation to retry the resolution.
          requestedImageIdsRef.current.delete(target.id);
          console.error('Failed to resolve practice images:', err);
          setResolvedById((prev) =>
            prev[target.id] ? prev : { ...prev, [target.id]: target },
          );
        });
    }
  }, [currentIndex, questions, imageService]);
  // Mirror answers and verifications for navigation handlers without closing over stale state.
  const answersRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const verificationsRef = useRef<Record<string, QuestionVerificationState>>({});
  useEffect(() => {
    verificationsRef.current = verifications;
  }, [verifications]);

  // Per-question elapsed time: navigating away parks the current clock,
  // navigating back restores it instead of resetting to zero.
  const currentIndexRef = useRef(0);
  const timeElapsedRef = useRef<number>(0);
  const elapsedByQuestionRef = useRef<Record<string, number>>({});
  useEffect(() => {
    timeElapsedRef.current = timeElapsed;
  }, [timeElapsed]);

  const handleGoToQuestion = useCallback((newIndex: number) => {
    const currentItemId = questions[currentIndexRef.current]?.id;
    if (currentItemId) {
      elapsedByQuestionRef.current[currentItemId] = timeElapsedRef.current;
    }
    const nextItem = questions[newIndex];
    currentIndexRef.current = newIndex;
    setCurrentIndex(newIndex);
    setUserAnswer(nextItem ? (answersRef.current[nextItem.id] ?? null) : null);
    setNavigatorOpen(false);
    const isAlreadyVerified = nextItem
      ? (nextItem.isPassage && nextItem.questions
          ? nextItem.questions.every((q) => verificationsRef.current[q.id]?.isVerified)
          : Boolean(verificationsRef.current[nextItem.id]?.isVerified))
      : false;
    // Verified items stay paused; unverified items resume their parked clock
    // (or start at 0 on first visit) instead of always resetting.
    if (isAlreadyVerified) {
      const parked = nextItem ? elapsedByQuestionRef.current[nextItem.id] : undefined;
      setTimeElapsed(parked ?? 0);
      setTimerActive(false);
    } else {
      const parked = nextItem ? elapsedByQuestionRef.current[nextItem.id] : undefined;
      setTimeElapsed(parked ?? 0);
      setTimerActive(true);
    }
  }, [questions]);

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

  // Single interval for counting up elapsed time
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerActive]);

  const updateRating = usePracticeStore((state) => state.updateRating);

  const handleRatingSelect = async (difficulty: Difficulty) => {
    if (!currentItem) return;

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
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
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

  const isItemAnswered = (item: PracticeQuestion): boolean => {
    if (item.isPassage && item.questions) {
      return (
        item.questions.length > 0 &&
        item.questions.every((child) => isItemAnswered(child))
      );
    }
    const a = answers[item.id] ?? (item.id === currentItem?.id ? userAnswer : null);
    if (a === undefined || a === null) return false;
    // Figure sequence: dual selection requires both image1 and image2
    if (typeof a === 'object' && a !== null && 'image1' in a && 'image2' in a) {
      const fsObj = a as { image1: unknown; image2: unknown };
      return fsObj.image1 !== null && fsObj.image1 !== undefined && fsObj.image2 !== null && fsObj.image2 !== undefined;
    }
    if (Array.isArray(a)) {
      return a.length > 0 && a.every((v) => v !== null && v !== undefined);
    }
    if (typeof a === 'string') {
      return a.trim().length > 0;
    }
    return true;
  };

  const isItemVerified = (item: PracticeQuestion): boolean => {
    if (item.isPassage && item.questions) {
      return (
        item.questions.length > 0 &&
        item.questions.every((child) => verifications[child.id]?.isVerified)
      );
    }
    return Boolean(verifications[item.id]?.isVerified);
  };

  const isItemCorrect = (item: PracticeQuestion): boolean => {
    if (item.isPassage && item.questions) {
      return (
        item.questions.length > 0 &&
        item.questions.every((child) => verifications[child.id]?.isCorrect)
      );
    }
    return Boolean(verifications[item.id]?.isCorrect);
  };

  const currentIsAnswered = currentItem ? isItemAnswered(currentItem) : false;
  const currentIsVerified = currentItem ? isItemVerified(currentItem) : false;
  const currentIsCorrect = currentItem ? isItemCorrect(currentItem) : false;

  const isLastQuestion = currentIndex >= questions.length - 1;
  const answeredCount = questions.filter((q) => isItemAnswered(q)).length;

  // Maps a loaded row (question or grouped passage) to renderer input,
  // preserving nested passage children — dropping them makes ModuleMCQ
  // render one repeated single-question fallback per child.
  const toQuestionData = (item: PracticeQuestion, index: number): QuestionData => ({
    id: item.id || `q-${index}`,
    sectionId: item.section_id || 'practice',
    sortOrder: index + 1,
    questionType: item.question_type || subtestType,
    content: item.content ?? item,
    isPassage: item.isPassage,
    ...(Array.isArray(item.questions)
      ? { questions: item.questions.map((child, childIndex) => toQuestionData(child, childIndex)) }
      : {}),
  });

  const resolvedCurrent = resolvedById[currentItem.id] ?? null;
  const qData: QuestionData = toQuestionData(resolvedCurrent ?? currentItem, currentIndex);

  // Per-child answers for grouped (passage) items, keyed by child id — what
  // ModuleMCQ reads. Undefined when nothing answered so the renderer keeps
  // its own fallback.
  const passageChildAnswers = (() => {
    if (!currentItem.isPassage || !currentItem.questions) return undefined;
    const entries: Array<[string, string]> = [];
    for (const child of currentItem.questions) {
      const childAnswer = answers[child.id];
      if (typeof childAnswer === 'string') entries.push([child.id, childAnswer]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  })();

  const handleAnswerChange = (value: unknown, questionId?: string) => {
    const key = questionId ?? currentItem.id;
    if (verifications[key]?.isVerified) return; // Disallow modification after verification
    if (!questionId || questionId === currentItem.id) setUserAnswer(value);
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const handleCheckAnswer = async () => {
    if (!currentItem || isCheckingAnswer || currentIsVerified) return;

    const itemsToVerify: Array<{ questionId: string; answer: unknown }> = [];
    if (currentItem.isPassage && currentItem.questions) {
      for (const child of currentItem.questions) {
        if (answers[child.id] !== undefined && answers[child.id] !== null) {
          itemsToVerify.push({ questionId: child.id, answer: answers[child.id] });
        }
      }
    } else {
      const ans = userAnswer ?? answers[currentItem.id];
      if (ans !== undefined && ans !== null) {
        itemsToVerify.push({ questionId: currentItem.id, answer: ans });
      }
    }

    if (itemsToVerify.length === 0) return;

    setIsCheckingAnswer(true);
    try {
      const res = await fetch('/api/practice/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToVerify }),
      });

      if (!res.ok) {
        let errMessage = 'Failed to verify answer';
        try {
          const errData = await res.json();
          if (errData && typeof errData === 'object' && 'error' in errData) {
            errMessage = String((errData as { error: unknown }).error);
          }
        } catch {
          // ignore error body parsing failure
        }
        console.error('Failed to verify answer:', errMessage);
        return;
      }

      const rawData = await res.json().catch(() => null);
      if (!rawData || typeof rawData !== 'object') {
        console.error('Failed to verify answer: invalid response payload');
        return;
      }

      const data = rawData as Record<string, unknown>;
      const resultsList: Array<{
        questionId: string;
        isCorrect: boolean;
        correctAnswer: unknown;
      }> = [];

      if (Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item && typeof item === 'object' && 'questionId' in item && typeof (item as { questionId: unknown }).questionId === 'string') {
            const typedItem = item as { questionId: string; isCorrect?: unknown; correctAnswer?: unknown };
            resultsList.push({
              questionId: typedItem.questionId,
              isCorrect: Boolean(typedItem.isCorrect),
              correctAnswer: typedItem.correctAnswer,
            });
          }
        }
      } else if (data.results && typeof data.results === 'object') {
        for (const [qId, val] of Object.entries(data.results as Record<string, unknown>)) {
          if (val && typeof val === 'object') {
            const typedVal = val as { isCorrect?: unknown; correctAnswer?: unknown };
            resultsList.push({
              questionId: qId,
              isCorrect: Boolean(typedVal.isCorrect),
              correctAnswer: typedVal.correctAnswer,
            });
          }
        }
      }

      setVerifications((prev) => {
        const updated = { ...prev };
        for (const item of resultsList) {
          updated[item.questionId] = {
            isVerified: true,
            isCorrect: item.isCorrect,
            correctAnswer: item.correctAnswer,
          };
        }
        return updated;
      });

      setTimerActive(false);
      const currentItemId = questions[currentIndexRef.current]?.id;
      if (currentItemId) {
        elapsedByQuestionRef.current[currentItemId] = timeElapsedRef.current;
      }
    } catch (err) {
      console.error('Error verifying answer:', err);
    } finally {
      setIsCheckingAnswer(false);
    }
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
                {timerHidden ? '••:••' : formatTime(timeElapsed)}
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
              selectedAnswers: passageChildAnswers,
              onAnswer: handleAnswerChange,
              verification: verifications[currentItem.id],
              verifications: verifications,
            })}
          </div>
        </div>

        {/* Bottom dock (64px): help • navigator pill • rating + Back/Check/Next */}
        <footer className="flex-none min-h-16 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="hidden md:inline text-[13px] font-medium text-[#71717A]">Rate:</span>
            <div className="flex items-center gap-1.5">
              {RATING_OPTIONS.map(({ id, label, Icon }) => {
                const isActive = ratingMap[currentItem.id] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void handleRatingSelect(id)}
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
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[min(460px,calc(100vw-3rem))] bg-white border border-[#E5E7EB] rounded-xl p-3 z-40 shadow-lg">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-gray-100 mb-2">
                  <span className="text-[13px] font-medium text-[#71717A]">
                    {answeredCount} of {questions.length} answered
                  </span>
                  <span className="flex items-center gap-2.5 text-[11px] text-[#71717A]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Wrong
                    </span>
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
                    const isAnswered = isItemAnswered(q);
                    const isVerified = isItemVerified(q);
                    const isCorrect = isItemCorrect(q);

                    let btnColor = 'bg-white border-[#E5E7EB] text-[#71717A] hover:border-[#D1D5DB] hover:text-[#18181B]';
                    if (isVerified) {
                      if (isCorrect) {
                        btnColor = isActive
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-600 ring-offset-1 font-semibold'
                          : 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100 font-semibold';
                      } else {
                        btnColor = isActive
                          ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-600 ring-offset-1 font-semibold'
                          : 'bg-rose-50 border-rose-400 text-rose-700 hover:bg-rose-100 font-semibold';
                      }
                    } else if (isActive) {
                      btnColor = 'bg-[#18181B] border-[#18181B] text-white ring-2 ring-[#EA580C] ring-offset-1';
                    } else if (isAnswered) {
                      btnColor = 'bg-[#18181B] border-[#18181B] text-white hover:bg-zinc-800';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleGoToQuestion(idx)}
                        aria-label={`Go to question ${idx + 1}${
                          isVerified
                            ? isCorrect
                              ? ' (correct)'
                              : ' (incorrect)'
                            : isAnswered
                            ? ' (answered)'
                            : ''
                        }`}
                        title={`Question ${idx + 1}${
                          isVerified
                            ? isCorrect
                              ? ' (correct)'
                              : ' (incorrect)'
                            : isAnswered
                            ? ' (answered)'
                            : ''
                        }`}
                        className={`h-8 rounded-lg border text-[12px] font-semibold flex items-center justify-center transition-colors relative ${btnColor}`}
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
              className="h-10 px-4 text-sm font-medium rounded-[10px] border border-[#E5E7EB] bg-white text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Check Answer Button */}
            {!currentIsVerified ? (
              <button
                type="button"
                disabled={!currentIsAnswered || isCheckingAnswer}
                onClick={handleCheckAnswer}
                className="h-10 px-4 text-sm font-medium rounded-[10px] border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {isCheckingAnswer ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Check Answer
                  </>
                )}
              </button>
            ) : (
              <div
                className={`h-10 px-3.5 text-xs font-semibold rounded-[10px] flex items-center gap-1.5 border ${
                  currentIsCorrect
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-rose-50 text-rose-700 border-rose-300'
                }`}
              >
                {currentIsCorrect ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Checked: Correct
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    Checked: Incorrect
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLastQuestion) {
                  onExit();
                } else {
                  handleGoToQuestion(currentIndex + 1);
                }
              }}
              className="h-10 px-5 text-sm font-medium rounded-[10px] bg-[#18181B] text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
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
