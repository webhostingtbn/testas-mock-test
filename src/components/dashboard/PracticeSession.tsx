'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle2, AlertCircle, Smile, Meh, Frown } from 'lucide-react';
import { KniButton, KniCard } from '@/components/KniPrimitives';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';

interface PracticeSessionProps {
  subtestType: 'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq';
  subtestTitle: string;
  folderId: 'easy' | 'medium' | 'hard' | 'unclassified';
  questions: any[];
  userId: string;
  supabase: any;
  onExit: () => void;
  onQuestionRated: () => void; // Trigger list reload on ratings change
}

export default function PracticeSession({
  subtestType,
  subtestTitle,
  folderId,
  questions,
  userId,
  supabase,
  onExit,
  onQuestionRated,
}: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [ratings, setRatings] = useState<Record<string, 'easy' | 'medium' | 'hard' | null>>({});
  
  // Stopwatch per question
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex]);

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
  const currentRating = ratings[currentQuestion.id] ?? (folderId !== 'unclassified' ? folderId : null);

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
    switch (subtestType) {
      case 'figure_sequence':
        return (
          <FigureSequence
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
      case 'module_mcq':
        return (
          <ModuleMCQ
            passage={q}
            selectedAnswers={answers}
            onAnswer={handleChildAnswerChange}
          />
        );
      default:
        return <div className="text-center py-10">Unknown question type</div>;
    }
  };

  const isCorrect = getCorrectness();

  const ratingOptions = [
    { id: 'easy' as const, icon: Smile, title: 'Easy', activeClass: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-650' },
    { id: 'medium' as const, icon: Meh, title: 'Medium', activeClass: 'bg-amber-500 hover:bg-amber-400 text-white border-amber-550' },
    { id: 'hard' as const, icon: Frown, title: 'Hard', activeClass: 'bg-rose-500 hover:bg-rose-400 text-white border-rose-550' },
  ];

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full pb-24">
      {/* Practice Header Bar */}
      <div className="flex items-center justify-between border-b border-orange-100 bg-white/70 px-4 py-3 backdrop-blur-md rounded-2xl mb-2 shadow-sm">
        <div className="flex items-center gap-3">
          <KniButton
            variant="ghost"
            onClick={onExit}
            className="h-9 px-3 text-slate-500 hover:text-slate-800"
          >
            <X className="size-4 mr-1.5" />
            Exit Practice
          </KniButton>
          <div className="h-4 w-px bg-orange-100" />
          <h2 className="text-sm font-bold text-slate-800">
            {subtestTitle} — <span className="capitalize text-orange-700">{folderId} Bin</span>
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            {formatTime(seconds)}
          </div>
        </div>
      </div>

      {/* Main split question pane */}
      <div className="mx-auto w-full">
        {/* Question area */}
        <div className="bg-white border border-orange-100/60 rounded-2xl p-5 shadow-xs">
          {renderQuestion()}
        </div>
      </div>

      {/* Feedback Area */}
      {isCurrentAnswered && (
        <div className="max-w-5xl mx-auto w-full mt-6 px-1">
          <KniCard className={`p-4 border ${isCorrect ? 'border-emerald-250 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}>
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className={`text-sm font-bold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                </h4>
                <p className="mt-0.5 text-xs text-slate-650 leading-relaxed">
                  {isCorrect 
                    ? 'Great job! You have solved this question successfully. Keep it up!' 
                    : 'Review the question and try again. Your rating has been synced.'
                  }
                </p>
              </div>
            </div>
          </KniCard>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="absolute inset-x-0 bottom-0 bg-white border-t border-slate-200 shadow-xs py-3 z-30">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          {/* Left: Previous Button */}
          <div className="flex-1 flex justify-start">
            <KniButton
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              disabled={currentIndex === 0}
              variant="outline"
              className="h-10 px-4 text-xs"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </KniButton>
          </div>

          {/* Middle: Rating Smiley Buttons */}
          <div className="flex px-2 items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <div className="text-sm mr-1">
              <div>Rate again</div>
            </div>
            {ratingOptions.map((opt) => {
              const isActive = currentRating === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRatingChange(opt.id)}
                  title={opt.title}
                  className={`p-2 flex gap-1 rounded-lg border transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? `${opt.activeClass} shadow-xs scale-105` 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {opt.title}
                  <Icon className="w-5 h-5 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Right: Next Button */}
          <div className="flex-1 flex justify-end">
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
