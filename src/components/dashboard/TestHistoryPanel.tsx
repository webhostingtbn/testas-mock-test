"use client";

import {
  ChevronRight, Clock, CheckCircle2, PlayCircle, AlertTriangle
} from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';
import { isFullCompletion, isTerminalAttempt, isResumableAttempt } from '@/lib/types';
import type { ExamAttemptReview } from '@/components/dashboard/ReviewView';

interface TestHistoryPanelProps {
  pastExams: ExamAttemptReview[];
  selectedExamId: string;
  onSelectAttempt: (attempt: ExamAttemptReview) => void;
  onResumeAttempt: (attempt: ExamAttemptReview) => void;
}

export function TestHistoryPanel({ pastExams, selectedExamId, onSelectAttempt, onResumeAttempt }: TestHistoryPanelProps) {
  const testAttempts = pastExams
    .filter((attempt) => attempt.exam_id === selectedExamId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const completedAttempts = testAttempts.filter(attempt => isTerminalAttempt(attempt));
  const inProgressAttempts = testAttempts.filter(attempt => isResumableAttempt(attempt));

  const getPercentage = (attempt: ExamAttemptReview) => {
    if (!attempt.max_score || attempt.max_score === 0) return 0;
    return Math.round(((attempt.total_score ?? 0) / attempt.max_score) * 100);
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime)) return 'Date unavailable';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (completedAttempts.length === 0 && inProgressAttempts.length === 0) {
    return (
      <KniCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
              Attempt History
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              Your Performance
            </h2>
          </div>
          <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
            <Clock className="size-5" />
          </div>
        </div>

        <div className="mt-6 py-8 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-slate-50 text-slate-400 mx-auto mb-3">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="text-sm font-medium text-slate-900">No attempts yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Your test history will appear here after you complete an attempt.
          </p>
        </div>
      </KniCard>
    );
  }

  return (
    <KniCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
            Attempt History
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            Your Performance
          </h2>
        </div>
        <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
          <Clock className="size-5" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* In progress attempts */}
        {inProgressAttempts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              In Progress
            </h3>
            {inProgressAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      <Clock className="size-3" />
                      In Progress
                    </span>
                    <p className="text-xs text-slate-500">
                      Started on {formatDate(attempt.created_at)}
                    </p>
                  </div>
                </div>
                <KniButton
                  variant="secondary"
                  onClick={() => onResumeAttempt(attempt)}
                  className="h-9 px-4 text-xs font-bold"
                >
                  <PlayCircle className="size-3.5 mr-1.5" />
                  Resume
                </KniButton>
              </div>
            ))}
          </div>
        )}

        {/* Completed attempts */}
        {completedAttempts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Completed ({completedAttempts.length})
            </h3>
            {completedAttempts.map((attempt) => {
              const isEarly = attempt.completion_reason === 'ended_early';
              const totalScore = attempt.total_score ?? 0;
              const maxScore = attempt.max_score ?? 0;
              const answeredCount = isEarly ? (attempt.answered_count ?? 0) : maxScore;
              const accuracy = answeredCount > 0 ? Math.round((totalScore / answeredCount) * 100) : 0;
              const completion = maxScore > 0 ? Math.round((answeredCount / maxScore) * 100) : 0;

              return (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      Attempt on {formatDate(attempt.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isEarly ? (
                        <p className="text-xs text-slate-500">
                          Score: <span className="font-semibold text-slate-900">{totalScore}/{answeredCount}</span> correct • Answered <span className="font-semibold text-slate-900">{answeredCount}/{maxScore}</span> ({completion}%)
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Score: <span className="font-semibold text-slate-900">{totalScore}/{maxScore}</span> correct
                        </p>
                      )}
                      {isEarly && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          <AlertTriangle className="size-2.5" />
                          Ended Early
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-950">{accuracy}%</span>
                      <span className="block text-[9px] font-bold uppercase text-slate-400">
                        {isEarly ? 'Accuracy' : 'Score'}
                      </span>
                    </div>
                    <KniButton
                      variant="secondary"
                      onClick={() => onSelectAttempt(attempt)}
                      className="h-9 px-4 text-xs font-bold"
                    >
                      <ChevronRight className="size-3.5 ml-1" />
                      Review
                    </KniButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {completedAttempts.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Best Score</p>
            <p className="text-xl font-black text-slate-950 mt-1">
              {(() => {
                const fullCompletions = completedAttempts.filter(a => isFullCompletion(a));
                return fullCompletions.length > 0
                  ? `${Math.max(...fullCompletions.map(a => getPercentage(a)))}%`
                  : 'N/A';
              })()}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average</p>
            <p className="text-xl font-black text-slate-950 mt-1">
              {(() => {
                const fullCompletions = completedAttempts.filter(a => isFullCompletion(a));
                return fullCompletions.length > 0
                  ? `${Math.round(
                      fullCompletions.reduce((sum, a) => sum + getPercentage(a), 0) / fullCompletions.length
                    )}%`
                  : 'N/A';
              })()}
            </p>
          </div>
        </div>
      )}
    </KniCard>
  );
}
