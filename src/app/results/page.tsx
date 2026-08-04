"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { flattenExamAnswers, useExamStore } from "@/lib/store/exam-store";
import {
  GraduationCap,
  CheckCircle2,
  Home,
  Info,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { KniCard, KniButton, KniBackground } from "@/components/KniPrimitives";
import { calculateAccuracyPercentage, calculateCompletionPercentage } from "@/lib/exam/metrics";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function ResultsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [completionReason, setCompletionReasonState] = useState<'finished' | 'ended_early'>('finished');

  const {
    currentExamId,
    userExamId,
    answers,
    completionReason: storeCompletionReason,
    resetExam,
  } = useExamStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push("/dashboard");
    }
  }, [hydrated, currentExamId, router]);

  const processResults = useCallback(async () => {
    if (!userExamId || !currentExamId) return;

    setSubmitError(null);
    setIsRetrying(false);

    try {
      const res = await fetch(`/api/attempts/${userExamId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAnswers: flattenExamAnswers(answers),
          completionReason: storeCompletionReason,
        }),
      });

      if (!res.ok) {
        const errJson: unknown = await res.json().catch(() => ({}));
        const errObj = isRecord(errJson) ? errJson : {};
        const errMsg = typeof errObj.error === 'string' ? errObj.error : "Failed to submit exam attempt for scoring";
        throw new Error(errMsg);
      }

      const raw: unknown = await res.json();
      const data = isRecord(raw) ? raw : {};
      const resObj = isRecord(data.result) ? data.result : {};

      const score = typeof resObj.score === 'number' ? resObj.score : 0;
      const total = typeof resObj.total === 'number' && resObj.total > 0 ? resObj.total : 1;
      const answered = typeof resObj.answered_count === 'number' ? resObj.answered_count : total;
      const reason = resObj.completion_reason === 'ended_early' ? 'ended_early' as const : 'finished' as const;

      setTotalCorrect(score);
      setTotalQuestions(total);
      setAnsweredCount(answered);
      setCompletionReasonState(reason);
      setIsCalculated(true);
    } catch (err) {
      console.error("Failed to process exam results", err);
      setSubmitError(err instanceof Error ? err.message : "Scoring failed");
    }
  }, [userExamId, currentExamId, answers, storeCompletionReason]);

  useEffect(() => {
    if (!hydrated || !userExamId || !currentExamId) return;
    processResults();
  }, [hydrated, userExamId, currentExamId, processResults]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await processResults();
    setIsRetrying(false);
  };

  const isEndedEarly = completionReason === 'ended_early';

  if (!hydrated || !currentExamId) {
    return (
      <KniBackground className="min-h-screen flex items-center justify-center p-6 text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse font-medium">
            Loading...
          </p>
        </div>
      </KniBackground>
    );
  }

  // Show error state with retry
  if (submitError && !isCalculated) {
    return (
      <KniBackground className="min-h-screen flex items-center justify-center p-6 text-foreground">
        <KniCard className="p-8 sm:p-10 max-w-md w-full text-center space-y-4">
          <div className="grid size-14 place-items-center rounded-full bg-rose-100 text-rose-600 mx-auto">
            <AlertTriangle className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Scoring Failed</h2>
          <p className="text-sm text-muted-foreground">{submitError}</p>
          <KniButton
            onClick={handleRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry Scoring'}
          </KniButton>
          <p className="text-xs text-muted-foreground mt-2">
            Your answers are saved locally. Retry to complete scoring.
          </p>
        </KniCard>
      </KniBackground>
    );
  }

  // Loading state
  if (!isCalculated) {
    return (
      <KniBackground className="min-h-screen flex items-center justify-center p-6 text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse font-medium">
            Scoring exam on server...
          </p>
        </div>
      </KniBackground>
    );
  }

  const accuracyPercentage = calculateAccuracyPercentage(totalCorrect, answeredCount);
  const completionPercentage = calculateCompletionPercentage(answeredCount, totalQuestions);

  return (
    <KniBackground className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 text-foreground">
      <div className="max-w-4xl mx-auto space-y-8">
        <KniCard className="p-8 sm:p-10 border-primary/20 bg-card/60 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-border/40">
            <div className="flex items-center space-x-4">
              <div className={`p-3.5 rounded-2xl ${isEndedEarly ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                {isEndedEarly ? (
                  <Clock className="w-10 h-10" />
                ) : (
                  <GraduationCap className="w-10 h-10" />
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {isEndedEarly ? 'Test Ended Early' : 'Exam Completed'}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Server-verified result recorded
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <KniButton
                variant="outline"
                onClick={() => {
                  resetExam();
                  router.push("/dashboard");
                }}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </KniButton>
            </div>
          </div>

          {/* Ended Early Banner */}
          {isEndedEarly && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-amber-800">Ended Early</p>
                <p className="text-amber-700 mt-0.5">
                  You ended this test before completing all subtests.
                  {answeredCount === 0
                    ? ' No questions were answered.'
                    : ` ${answeredCount} of ${totalQuestions} questions were answered.`}
                </p>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 ${isEndedEarly ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 my-8`}>
            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Score
              </span>
              <span className="text-4xl font-extrabold text-primary mt-2">
                {totalCorrect} / {isEndedEarly ? answeredCount : totalQuestions}
              </span>
            </div>

            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {isEndedEarly ? 'Accuracy' : 'Percentage'}
              </span>
              <span className="text-4xl font-extrabold text-primary mt-2">
                {isEndedEarly ? accuracyPercentage : calculateAccuracyPercentage(totalCorrect, totalQuestions)}%
              </span>
            </div>

            {isEndedEarly && (
              <div className="p-6 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Completion
                </span>
                <span className="text-4xl font-extrabold text-amber-600 mt-2">
                  {completionPercentage}%
                </span>
              </div>
            )}

            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Status
              </span>
              {isEndedEarly ? (
                <span className="text-xl font-bold text-amber-600 mt-3 flex items-center gap-1.5">
                  <Clock className="w-5 h-5" /> Ended Early
                </span>
              ) : (
                <span className="text-xl font-bold text-emerald-500 mt-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" /> Completed
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Info className="w-4 h-4" />
            <span>Answer keys and scoring are secured server-side.</span>
          </div>
        </KniCard>
      </div>
    </KniBackground>
  );
}
