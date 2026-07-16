'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle2, AlertCircle, Smile, Meh, Frown } from 'lucide-react';
import { KniButton, KniBadge } from '@/components/KniPrimitives';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import CompletingPatterns from '@/components/question-types/CompletingPatterns';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';
import ModuleQuestion from '@/components/question-types/ModuleQuestion';
import NumericalSeries from '@/components/question-types/NumericalSeries';
import SecurityOverlay from '@/components/exam/SecurityOverlay';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';

interface PracticeSessionProps {
  subtestType: string;
  subtestTitle: string;
  folderId: 'easy' | 'medium' | 'hard' | 'unclassified';
  questions: any[];
  userId: string;
  userEmail: string;
  userFullName?: string | null;
  supabase: any;
  onExit: () => void;
  onQuestionRated: () => void; // Trigger list reload on ratings change
  isPaper?: boolean;
  isPracticeOnly?: boolean; // Reserved for future use - currently unused
}

const QUESTION_TIME_LIMITS: Record<string, number> = {
  figure_sequence: 75, // 75s Digital (Completing Patterns / Figure Sequences)
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
  eng_2: 81,
  eng_2_2d: 69,
  eng_2_3d: 69,
  eng_3: 163,
  module_mcq: 245,
};

const getLimitForSubtest = (type: string, isPaper: boolean) => {
  if (type === 'figure_sequence') return isPaper ? 55 : 75;
  return QUESTION_TIME_LIMITS[type] || 120;
};

export default function PracticeSession({
  subtestType,
  subtestTitle,
  folderId,
  questions,
  userId,
  userEmail,
  userFullName,
  supabase,
  onExit,
  onQuestionRated,
  isPaper = false,
  isPracticeOnly = false,
}: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [ratings, setRatings] = useState<Record<string, 'easy' | 'medium' | 'hard' | null>>({});
  
  // Stopwatch per question
  const [seconds, setSeconds] = useState(0);

  const limit = getLimitForSubtest(subtestType, isPaper);
  const isTimeExpired = seconds > limit;

  const switcherContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex]);

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, questions.length);
  }, [questions]);

  useEffect(() => {
    if (buttonRefs.current[currentIndex]) {
      buttonRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIndex]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (switcherContainerRef.current) {
      const scrollAmount = 200;
      switcherContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-orange-100 rounded-2xl max-w-xl mx-auto shadow-sm">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">No Questions Found</h3>
        <p className="text-sm text-slate-500 mt-2">
          There are no questions in this category for you.
        </p>
        <KniButton onClick={onExit} className="mt-6">
          Return to Bins
        </KniButton>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id] ?? null;

  // Only use stored ratings — do NOT fall back to folderId.
  // folderId is just where the user selected to practice from;
  // it does not mean every question in that list was rated.
  const currentRating: 'easy' | 'medium' | 'hard' | null = ratings[currentQuestion.id] ?? null;

  const isCurrentRated = currentRating !== null;
  const isCurrentAnswered = currentQuestion.isPassage && currentQuestion.questions
    ? currentQuestion.questions.every((childQ: any) => answers[childQ.id] !== undefined && answers[childQ.id] !== null)
    : currentAnswer !== null && currentAnswer !== undefined;

  const canNavigateNext = isCurrentRated; // The primary user constraint is to rate difficulty

  // Deep comparison helpers for checking answers
  const isDeepEqual = (a: any, b: any): boolean => {
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      const keys1 = Object.keys(a);
      const keys2 = Object.keys(b);
      if (keys1.length !== keys2.length) return false;
      for (const key of keys1) {
        if (a[key] !== b[key]) return false;
      }
      return true;
    }
    return a === b;
  };

  const formatAns = (a: any) => {
    if (a && typeof a === 'object') {
      if ('image1' in a && 'image2' in a) return [a.image1, a.image2];
      if ('A' in a && 'B' in a) return [a.A, a.B];
    }
    return a !== undefined ? a : null;
  };

  // Check correctness of answer
  const getCorrectness = () => {
    if (!isCurrentAnswered) return null;

    if (currentQuestion.isPassage && currentQuestion.questions) {
      return currentQuestion.questions.every((childQ: any) => {
        const userAns = answers[childQ.id];
        const correctAns = childQ.correct_answer;
        return isDeepEqual(formatAns(userAns), formatAns(correctAns));
      });
    }

    const type = currentQuestion.question_type || subtestType;
    if (type === 'numerical_series') {
      const getDistinctCharsSorted = (str: string) => {
        return Array.from(new Set(String(str).replace(/\s+/g, '').split(''))).sort().join('');
      };
      return getDistinctCharsSorted(currentAnswer) === getDistinctCharsSorted(currentQuestion.correct_answer);
    }

    return isDeepEqual(formatAns(currentAnswer), formatAns(currentQuestion.correct_answer));
  };

  const handleAnswerChange = (ans: any) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: ans,
    }));
  };

  const handleChildAnswerChange = (qId: string, ans: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: ans,
    }));
  };

  const handleRatingChange = async (difficulty: 'easy' | 'medium' | 'hard') => {
    setRatings((prev) => ({
      ...prev,
      [currentQuestion.id]: difficulty,
    }));

    // Save/upsert immediately to database
    if (userId) {
      try {
        const questionIdsToSync = currentQuestion.isPassage && currentQuestion.questions
          ? currentQuestion.questions.map((childQ: any) => childQ.id)
          : [currentQuestion.id];

        const upsertData = questionIdsToSync.map((qId: string) => ({
          user_id: userId,
          question_id: qId,
          difficulty: difficulty,
          updated_at: new Date().toISOString(),
        }));

        await supabase
          .from('user_question_practices')
          .upsert(upsertData, { onConflict: 'user_id,question_id' });

        onQuestionRated(); // Notify parent to refresh stats
      } catch (err) {
        console.error('Failed to sync difficulty rating during practice:', err);
      }
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = () => {
    const q = currentQuestion;

    if (q.isPassage) {
      return (
        <ModuleMCQ
          passage={q}
          selectedAnswers={answers}
          onAnswer={handleChildAnswerChange}
        />
      );
    }

    const type = q.question_type || subtestType;

    switch (type) {
      case 'figure_sequence':
        return (
          <FigureSequence
            question={q}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
          />
        );
      case 'completing patterns':
      case 'completing_patterns':
        return (
          <CompletingPatterns
            question={q}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
          />
        );
      case 'math_equation':
        return (
          <MathEquation
            question={q}
            currentAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
          />
        );
      case 'latin_square':
        return (
          <LatinSquare
            question={q}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
          />
        );
      case 'numerical_series':
        return (
          <NumericalSeries
            question={q}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
          />
        );
      case 'solving_quantitative':
      case 'inferring_relationships':
      default:
        const isCoreType = ['solving_quantitative', 'inferring_relationships'].includes(type);
        return (
          <ModuleQuestion
            question={q}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswerChange}
            isSplitLayout={!isCoreType}
          />
        );
    }
  };

  const isCorrect = getCorrectness();

  const ratingOptions = [
    { id: 'easy' as const, icon: Smile, title: 'Easy', activeClass: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-650' },
    { id: 'medium' as const, icon: Meh, title: 'Medium', activeClass: 'bg-amber-500 hover:bg-amber-400 text-white border-amber-550' },
    { id: 'hard' as const, icon: Frown, title: 'Hard', activeClass: 'bg-rose-500 hover:bg-rose-400 text-white border-rose-550' },
  ];

  return (
    <div className="h-full mx-auto flex flex-col overflow-hidden">
      {/* <SecurityOverlay /> */}
      <WatermarkOverlay email={userEmail} fullName={userFullName} />
      {/* Practice Header Card */}
      <div className="bg-white/80 border border-orange-100/60 rounded-2xl mb-6 shadow-sm p-4 backdrop-blur-md">
        {/* Top Row: Exit & Subtest Title (Left) + Progress & Timer (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-100">
          {/* Left section: Exit Button & Title badge */}
          <div className="flex flex-wrap items-center gap-3">
            <KniButton
              variant="ghost"
              onClick={onExit}
              className="h-9 px-3 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X className="size-4 mr-1.5" />
              Exit Practice
            </KniButton>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {subtestTitle}
              </span>
              <KniBadge 
                status={folderId === 'easy' ? 'Easy' : folderId === 'medium' ? 'Medium' : folderId === 'hard' ? 'Hard' : 'Unclassified'} 
                className="capitalize" 
              />
            </div>
          </div>

          {/* Right section: Progress Indicator & Timer */}
          <div className="flex items-center justify-between sm:justify-end gap-4">
            {/* Progress Badge */}
            <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
              Question <span className="font-bold text-slate-800">{currentQuestion.display_number ?? (currentIndex + 1)}</span> of <span className="font-bold text-slate-800">{currentQuestion.total_subtest_questions ?? questions.length}</span>
            </div>

            {/* Timer Badge */}
            <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-slate-700 bg-slate-100 border border-slate-100/50 px-3 py-1.5 rounded-lg shrink-0">
              <Clock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
              <span className={isTimeExpired ? 'text-rose-600' : ''}>
                {formatTime(seconds)}
              </span>
              {isTimeExpired && (
                <span className="ml-1 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-sans font-semibold">
                  Limit Exceeded ({limit}s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Question Switcher Grid */}
        <div className="pt-3 flex items-center justify-between gap-3">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors hidden sm:flex items-center justify-center shrink-0 cursor-pointer"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Switcher Container */}
          <div 
            ref={switcherContainerRef}
            className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-orange-200 py-1.5 scroll-smooth"
          >
            <div className="flex gap-2 w-fit mx-auto px-4">
              {questions.map((q, idx) => {
                const isActive = currentIndex === idx;
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null;
                const isRated = ratings[q.id] !== undefined;

                let btnClass = "bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:text-slate-900";
                if (isActive) {
                  btnClass = "bg-orange-500 border-orange-500 text-white font-extrabold shadow-sm scale-110 ring-2 ring-orange-200 ring-offset-1";
                } else if (isAnswered || isRated) {
                  btnClass = "bg-orange-100/60 border-orange-200 text-orange-850 hover:bg-orange-100";
                }
                if (!isActive && !isCurrentRated) {
                  btnClass += " opacity-50 cursor-not-allowed hover:bg-white hover:text-slate-650";
                }

                return (
                  <button
                    key={q.id}
                    ref={(el) => {
                      buttonRefs.current[idx] = el;
                    }}
                    type="button"
                    disabled={!isActive && !isCurrentRated}
                    onClick={() => setCurrentIndex(idx)}
                    title={!isActive && !isCurrentRated ? "Rate the current question first to proceed" : undefined}
                    className={`w-9 h-9 rounded-full border text-xs font-bold flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer ${btnClass}`}
                  >
                    {q.display_number ?? (idx + 1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors hidden sm:flex items-center justify-center shrink-0 cursor-pointer"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main split question pane */}
      <div className="mx-auto flex flex-1 min-h-0 w-full flex-col lg:h-auto">
        {/* Question area */}
        <div className="bg-white border border-orange-100/60 rounded-2xl p-5 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
          {renderQuestion()}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mx-auto grid grid-cols-2 items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Previous Button */}
          <div className="order-2 flex justify-start md:order-1">
            <KniButton
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              disabled={currentIndex === 0 || !isCurrentRated}
              title={!isCurrentRated ? "Rate the current question first to proceed" : undefined}
              variant="outline"
              className="h-10 px-4 text-xs disabled:opacity-25"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </KniButton>
          </div>

          {/* Middle: Rating Smiley Buttons */}
          <div className="order-1 col-span-2 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1 md:order-2 md:col-span-1 md:flex-nowrap md:px-2">
            {isCurrentAnswered && (
              <span
                title={isCorrect ? 'Correct answer' : 'Review the question and try again'}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold ${
                  isCorrect
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {isCorrect ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}
                {isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            )}
            {/* Rating mode: allow changing ratings */}
            <div className="text-sm mr-1 font-semibold text-slate-500">
              {isTimeExpired ? (
                <div className="text-[10px] text-rose-500 leading-tight max-w-[125px] text-center sm:text-left animate-fade-in">
                  Time limit exceeded. Easy disabled.
                </div>
              ) : (
                <div>Rate again</div>
              )}
            </div>
            {ratingOptions.map((opt) => {
              const isActive = currentRating === opt.id;
              const Icon = opt.icon;
              const isEasyDisabled = opt.id === 'easy' && isTimeExpired;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isEasyDisabled}
                  onClick={(e) => {
                    console.log('Rating clicked:', opt.id, 'isEasyDisabled:', isEasyDisabled, 'currentRating:', currentRating);
                    e.stopPropagation();
                    handleRatingChange(opt.id);
                  }}
                  title={isEasyDisabled ? `Time limit (${limit}s) exceeded. Easy rating disabled.` : opt.title}
                  className={`p-2 flex gap-1 rounded-lg border transition-all duration-150 ${
                    isEasyDisabled
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                      : isActive
                        ? `${opt.activeClass} shadow-xs scale-105 cursor-pointer`
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  {opt.title}
                  <Icon className="w-5 h-5 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Right: Next Button */}
          <div className="order-3 flex justify-end">
            <KniButton
              onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
              disabled={currentIndex === questions.length - 1 || !canNavigateNext}
              className="h-10 px-5 text-xs bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-25"
              title={!canNavigateNext ? "Rate the current question first to proceed" : undefined}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </KniButton>
          </div>
        </div>
      </div>
    </div>
  );
}
