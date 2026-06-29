"use client";

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Box,
  Brain,
  Calculator,
  ChevronRight,
  Clock,
  FileText,
  PlayCircle,
  Puzzle,
} from 'lucide-react';
import { KniButton, KniCard } from '@/components/KniPrimitives';
import type { Exam, Profile } from '@/lib/types';
import { ReviewView, type ExamAttemptReview } from './ReviewView';

interface TestSelectionViewProps {
  profile: Profile | null;
  exams: Exam[];
  selectedExam: Exam | null;
  onSelectExam: (exam: Exam) => void;
  pastExams: ExamAttemptReview[];
  selectedTestHistory: ExamAttemptReview[];
  onStartBriefing: () => void;
  onResumeAttempt: (attempt: ExamAttemptReview) => void;
}

interface ExamDisplayInfo {
  duration: number;
  questions: number;
  hasCompleted: boolean;
  isInProgress: boolean;
  bestPct: number;
  progressPct: number;
}

interface ExamCardVisuals {
  icon: ReactNode;
  bgColor: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAttemptTimestamp(attempt: ExamAttemptReview): number {
  return new Date(attempt.created_at || 0).getTime();
}

export function TestSelectionView({
  profile,
  exams,
  selectedExam,
  onSelectExam,
  pastExams,
  selectedTestHistory,
  onStartBriefing,
  onResumeAttempt,
}: TestSelectionViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [mobileView, setMobileView] = useState<'list' | 'dashboard'>('list');

  const activeExams = useMemo(() => exams.filter((exam) => exam.is_active), [exams]);

  const getExamDisplayInfo = useCallback((exam: Exam): ExamDisplayInfo => {
    const attempts = pastExams.filter((attempt) => attempt.exam_id === exam.id);
    const hasCompleted = attempts.some((attempt) => attempt.status === 'completed');
    const hasStarted = attempts.length > 0;

    const sections = exam.sections || [];
    const totalDurationSeconds = sections.reduce((sum, section) => sum + (section.duration_seconds || 0), 0);
    const isPaper = exam.format === 'Paper';
    const duration = totalDurationSeconds > 0
      ? Math.round(totalDurationSeconds / 60) + (isPaper ? 15 : 10)
      : (isPaper ? 170 : 130);
    const questions = sections.reduce((sum, section) => sum + (section.question_count || 0), 0) || (isPaper ? 120 : 90);

    let bestPct = 0;
    attempts.forEach((attempt) => {
      if (attempt.status === 'completed' && attempt.total_score !== null && attempt.max_score) {
        const pct = Math.round((attempt.total_score / attempt.max_score) * 100);
        if (pct > bestPct) bestPct = pct;
      }
    });

    let progressPct = 0;
    if (hasStarted && !hasCompleted) {
      const latestAttempt = [...attempts].sort((a, b) => getAttemptTimestamp(b) - getAttemptTimestamp(a))[0];
      const detailed = latestAttempt?.detailed_results;
      const completedSections = isRecord(detailed) ? Object.keys(detailed).length : 0;
      const totalSections = sections.length || 4;
      progressPct = Math.round((completedSections / totalSections) * 100);
      if (progressPct === 0) progressPct = 10;
    }

    return {
      duration,
      questions,
      hasCompleted,
      isInProgress: hasStarted && !hasCompleted,
      bestPct,
      progressPct,
    };
  }, [pastExams]);

  const filteredExams = useMemo(() => {
    // TODO: temp comment out filter - show all exams regardless of tab
    return activeExams;
    // return activeExams.filter((exam) => {
    //   const info = getExamDisplayInfo(exam);
    //   if (activeTab === 'completed') return info.hasCompleted;
    //   if (activeTab === 'in_progress') return info.isInProgress;
    //   return true;
    // });
  }, [activeExams /* , activeTab, getExamDisplayInfo */]);

  const handleSelectExam = (exam: Exam) => {
    onSelectExam(exam);
    setMobileView('dashboard');
  };

  const getExamCardVisuals = (title: string): ExamCardVisuals => {
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle.includes('math') || normalizedTitle.includes('quant')) {
      return {
        icon: <Calculator className="size-5" />,
        bgColor: 'bg-amber-50 text-amber-600 border-amber-100/50',
      };
    }

    if (normalizedTitle.includes('read') || normalizedTitle.includes('verbal') || normalizedTitle.includes('analys')) {
      return {
        icon: <BookOpen className="size-5" />,
        bgColor: 'bg-orange-50 text-orange-600 border-orange-100/50',
      };
    }

    if (normalizedTitle.includes('pattern') || normalizedTitle.includes('figure')) {
      return {
        icon: <Puzzle className="size-5" />,
        bgColor: 'bg-purple-50 text-purple-600 border-purple-100/50',
      };
    }

    if (normalizedTitle.includes('spatial') || normalizedTitle.includes('solid')) {
      return {
        icon: <Box className="size-5" />,
        bgColor: 'bg-blue-50 text-blue-600 border-blue-100/50',
      };
    }

    if (normalizedTitle.includes('logic') || normalizedTitle.includes('reason')) {
      return {
        icon: <Brain className="size-5" />,
        bgColor: 'bg-emerald-50 text-emerald-600 border-emerald-100/50',
      };
    }

    return {
      icon: <FileText className="size-5" />,
      bgColor: 'bg-orange-50 text-orange-600 border-orange-100/50',
    };
  };

  if (activeExams.length === 0) {
    return (
      <div className="h-full max-w-[1480px] mx-auto flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <KniCard className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-orange-100/50 bg-orange-50/10 p-8 py-16 text-center">
          <Clock className="mb-3 size-10 text-orange-300" />
          <h4 className="text-base font-black text-slate-900">No active mock exams available</h4>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
            There is currently no active mock test configured in the system. Please check back later or contact an administrator.
          </p>
          <KniButton
            onClick={() => router.push('/dashboard')}
            className="mt-5 h-11 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white animate-fade-in"
          >
            Go Back to Dashboard
            <ChevronRight className="ml-1 size-4" />
          </KniButton>
        </KniCard>
      </div>
    );
  }

  const attempts = [...selectedTestHistory].sort((a, b) => getAttemptTimestamp(a) - getAttemptTimestamp(b));
  const completedAttempts = attempts.filter((attempt) => attempt.status === 'completed');
  const latestCompleted = completedAttempts[completedAttempts.length - 1] ?? null;

  return (
    <div className="h-full w-full mx-auto overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr] h-full">
        <div className={`flex flex-col gap-4 overflow-hidden rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm transition duration-200 sm:p-6 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)] min-h-0 ${mobileView === 'dashboard' ? 'hidden lg:flex' : 'flex'}`}>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Available Tests</h2>
            <p className="mt-1 text-xs text-slate-500">Choose an active test to view details or start.</p>
          </div>

          {/* <div className="flex rounded-xl border border-slate-250/20 bg-slate-100/85 p-1">
            {(['all', 'completed', 'in_progress'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-bold capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'border border-slate-200/10 bg-white font-extrabold text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'in_progress' ? 'In Progress' : tab}
              </button>
            ))}
          </div> */}

          <div className="flex max-h-[400px] flex-col gap-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-280px)]">
            {filteredExams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                <p className="text-xs font-semibold text-slate-500">No tests match this filter</p>
              </div>
            ) : (
              filteredExams.map((exam) => {
                const info = getExamDisplayInfo(exam);
                const isSelected = selectedExam?.id === exam.id;
                const visuals = getExamCardVisuals(exam.title);

                return (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    className={`group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-l-4 p-4 transition-all hover:shadow-xs ${
                      isSelected
                        ? 'border-orange-500 border-l-orange-500 bg-orange-500/5 shadow-xs'
                        : 'border-slate-150 border-l-transparent bg-white hover:border-slate-350'
                    }`}
                  >
                    <div className={`grid size-11 shrink-0 place-items-center rounded-xl transition ${visuals.bgColor}`}>
                      {visuals.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-black text-slate-950 transition group-hover:text-orange-600">
                        {exam.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        {info.duration} min • {info.questions} questions
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-right">
                      <div className="flex flex-col items-end">
                        {info.hasCompleted ? (
                          <>
                            <span className="text-xs font-black text-emerald-600">{info.bestPct}%</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</span>
                          </>
                        ) : info.isInProgress ? (
                          <>
                            <span className="text-xs font-black text-amber-600">{info.progressPct}%</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Progress</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-black text-slate-400">0%</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Not Started</span>
                          </>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-slate-450 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedExam && (
          <div className={`${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col gap-6 rounded-xl border border-slate-100 bg-white p-6 shadow-sm transition duration-200 min-w-0 min-h-0 w-full`}>
            <button
              onClick={() => setMobileView('list')}
              className="mb-2 flex cursor-pointer items-center gap-1.5 text-sm font-black text-slate-550 transition hover:text-slate-800 lg:hidden"
            >
              <ArrowLeft className="size-4" />
              Back to Tests
            </button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                {selectedExam.title}
              </h1>

              <KniButton
                onClick={onStartBriefing}
                className="flex h-11 items-center gap-1.5 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition cursor-pointer hover:bg-orange-500"
              >
                <PlayCircle className="size-4.5" />
                Start Test
              </KniButton>
            </div>

            {latestCompleted ? (
              <ReviewView
                profile={profile}
                attempt={latestCompleted}
                pastExams={pastExams}
              />
            ) : (
              <KniCard className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
                <Award className="mb-3 size-10 text-slate-300" />
                <h2 className="text-lg font-black tracking-tight text-slate-950">No review available yet</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Complete this mock test once to see the review breakdown here.
                </p>
                {attempts.some((attempt) => attempt.status !== 'completed') && (
                  <KniButton
                    variant="secondary"
                    onClick={() => {
                      const latestInProgress = [...attempts]
                        .filter((attempt) => attempt.status !== 'completed')
                        .sort((a, b) => getAttemptTimestamp(b) - getAttemptTimestamp(a))[0];
                      if (latestInProgress) onResumeAttempt(latestInProgress);
                    }}
                    className="mt-5 h-10 rounded-xl px-4 text-xs font-semibold"
                  >
                    <Clock className="mr-1.5 size-3.5" />
                    Resume In-Progress Test
                  </KniButton>
                )}
              </KniCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
