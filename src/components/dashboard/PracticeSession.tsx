'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Smile, Meh, Frown } from 'lucide-react';
import { KniButton } from '@/components/KniPrimitives';
import SecurityOverlay from '@/components/exam/SecurityOverlay';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import { questionRendererFactory, QuestionData } from '@/lib/exam/renderer';

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

  useEffect(() => {
    const defaultSecs = QUESTION_TIME_LIMITS[subtestType] || 90;
    setTimeRemaining(defaultSecs);
    setTimerActive(true);
    const nextItem = questions[currentIndex];
    setUserAnswer(nextItem ? answers[nextItem.id] ?? null : null);
  }, [answers, currentIndex, questions, subtestType]);

  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  useEffect(() => {
    if (timeRemaining <= 0 && timerActive) {
      setTimerActive(false);
    }
  }, [timeRemaining, timerActive]);

  const handleRatingSelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!currentItem || timeRemaining <= 0) return;

    const itemKey = currentItem.id;
    setRatingMap((prev) => ({ ...prev, [itemKey]: difficulty }));

    if (userId) {
      try {
        const questionIdsToSync = currentItem.isPassage && currentItem.questions
          ? currentItem.questions.map((childQ) => childQ.id)
          : [currentItem.id];

        for (const qId of questionIdsToSync) {
          await fetch(`/api/practice/${qId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty }),
          });
        }

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
      <SecurityOverlay />
      <WatermarkOverlay email={userEmail} fullName={userFullName} />
      <div className="min-h-screen bg-background flex flex-col text-foreground select-none">
        <header className="border-b border-border/40 bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <KniButton variant="ghost" onClick={onExit}>
              <X className="w-5 h-5" />
            </KniButton>
            <div>
              <h2 className="font-semibold text-lg">{subtestTitle}</h2>
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

        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
          <div className="bg-card/40 border border-border/40 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
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

          <div className="flex items-center justify-between border-t border-border/40 pt-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2 font-medium">Difficulty Rating:</span>
              <KniButton
                variant={ratingMap[currentItem.id] === 'easy' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('easy')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs"
              >
                <Smile className="w-3.5 h-3.5" /> Easy
              </KniButton>
              <KniButton
                variant={ratingMap[currentItem.id] === 'medium' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('medium')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs"
              >
                <Meh className="w-3.5 h-3.5" /> Medium
              </KniButton>
              <KniButton
                variant={ratingMap[currentItem.id] === 'hard' ? 'primary' : 'outline'}
                onClick={() => handleRatingSelect('hard')}
                disabled={timeRemaining <= 0}
                className="gap-1.5 text-xs"
              >
                <Frown className="w-3.5 h-3.5" /> Hard
              </KniButton>
            </div>

            <div className="flex items-center gap-3">
              <KniButton
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </KniButton>

              <KniButton
                onClick={() => {
                  if (isLastQuestion) {
                    onExit();
                  } else {
                    setCurrentIndex((prev) => prev + 1);
                  }
                }}
                className="gap-1.5"
              >
                {isLastQuestion ? 'Finish Practice' : 'Next'} <ChevronRight className="w-4 h-4" />
              </KniButton>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
