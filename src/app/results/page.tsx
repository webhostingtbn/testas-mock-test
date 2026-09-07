"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { flattenExamAnswers, useExamStore } from "@/lib/store/exam-store";
import {
  Check,
  Home,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
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

  const goDashboard = useCallback(() => {
    resetExam();
    router.push("/dashboard");
  }, [resetExam, router]);

  const isEndedEarly = completionReason === 'ended_early';

  if (!hydrated || !currentExamId) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18181B]"></div>
          <p className="text-sm text-[#71717A] animate-pulse font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // Show error state with retry
  if (submitError && !isCalculated) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 max-w-md w-full text-center flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-[18px] font-semibold text-[#18181B]">Scoring failed</h2>
          <p className="text-sm text-[#71717A]">{submitError}</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-1 h-10 px-6 text-sm font-medium rounded-[10px] bg-[#18181B] text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying…' : 'Retry scoring'}
          </button>
          <p className="text-[13px] text-[#71717A]">
            Your answers are saved. Retry to complete scoring.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isCalculated) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18181B]"></div>
          <p className="text-sm text-[#71717A] animate-pulse font-medium">
            Scoring your exam…
          </p>
        </div>
      </div>
    );
  }

  const accuracyPercentage = calculateAccuracyPercentage(totalCorrect, answeredCount);
  const completionPercentage = calculateCompletionPercentage(answeredCount, totalQuestions);
  const wrongCount = Math.max(0, answeredCount - totalCorrect);
  const skippedCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="min-h-screen bg-[#F4F4F5] py-8 sm:py-12 px-4 sm:px-6">
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 flex flex-col gap-6 sm:gap-8">

        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
              <h2 className="text-xl font-semibold text-[#18181B]">Exam Results</h2>
            </div>
            <p className="text-sm text-[#71717A] mt-1.5">
              You answered {answeredCount} of {totalQuestions} questions
              {isEndedEarly ? ' · test ended early' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={goDashboard}
            className="shrink-0 h-10 px-4 text-sm font-medium rounded-[10px] border border-[#E5E7EB] bg-white text-[#18181B] hover:bg-[#FAFAFA] transition-colors flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Ended Early Banner */}
        {isEndedEarly && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-px" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Ended early</p>
              <p className="text-amber-700 mt-0.5">
                You ended this test before completing all subtests.
                {answeredCount === 0
                  ? ' No questions were answered.'
                  : ` ${answeredCount} of ${totalQuestions} questions were answered.`}
              </p>
            </div>
          </div>
        )}

        {/* Metric strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-[#F4F4F5] border border-gray-100">
            <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Score</p>
            <p className="text-2xl font-bold text-[#18181B] mt-1 tabular-nums">
              {totalCorrect} <span className="text-sm font-normal text-[#71717A]">/ {isEndedEarly ? answeredCount : totalQuestions}</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F4F4F5] border border-gray-100">
            <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Accuracy</p>
            <p className="text-2xl font-bold text-[#18181B] mt-1 tabular-nums">
              {isEndedEarly ? accuracyPercentage : calculateAccuracyPercentage(totalCorrect, totalQuestions)}%
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F4F4F5] border border-gray-100">
            <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Answered</p>
            <p className="text-2xl font-bold text-[#18181B] mt-1 tabular-nums">
              {answeredCount} <span className="text-sm font-normal text-[#71717A]">/ {totalQuestions}</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F4F4F5] border border-gray-100">
            <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Outcome</p>
            {isEndedEarly ? (
              <p className="text-lg font-semibold text-amber-600 mt-1.5">Ended early</p>
            ) : (
              <p className="text-lg font-semibold text-emerald-600 mt-1.5">Completed</p>
            )}
            <p className="text-[13px] text-[#71717A] mt-0.5">{completionPercentage}% of questions seen</p>
          </div>
        </div>

        {/* Question summary */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5 text-[#18181B]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold tabular-nums">{totalCorrect}</span> correct
          </span>
          <span className="flex items-center gap-1.5 text-[#18181B]">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-semibold tabular-nums">{wrongCount}</span> wrong
          </span>
          <span className="flex items-center gap-1.5 text-[#18181B]">
            <span className="w-2 h-2 rounded-full bg-zinc-300" />
            <span className="font-semibold tabular-nums">{skippedCount}</span> skipped
          </span>
        </div>

        {/* Action bar */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={goDashboard}
            className="h-10 px-4 text-sm font-medium rounded-[10px] text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={goDashboard}
            title="Find this attempt in your test history to review each answer"
            className="h-10 px-6 text-sm font-medium rounded-[10px] bg-[#18181B] text-white hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
          >
            Review Answers
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
