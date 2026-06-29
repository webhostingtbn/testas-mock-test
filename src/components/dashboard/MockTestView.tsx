"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import {
  ClipboardCheck, Check, X, Timer, FileText, ShieldCheck,
  Wifi, Volume2, Maximize2, Calculator, ChevronRight, FilePenLine, Laptop,
  ArrowLeft
} from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';
import type { Profile } from '@/lib/types';
import { TestSelectionView } from './TestSelectionView';

interface MockTestViewProps {
  profile: Profile | null;
  pastExams: any[];
  briefingChecklist: string[];
  onToggleChecklistItem: (id: string) => void;
  isStarting: boolean;
  hasActiveExam: boolean;
  isEligible: boolean;
  onStartExam: () => void;
  exams: any[];
  selectedExam: any | null;
  selectedExamDetails: {
    sectionsCount: number;
    questionsCount: number;
    totalDurationMinutes: number;
    isLoading: boolean;
  } | null;
  onSelectExam: (exam: any | null) => void;
  getExamAttemptInfo: (exam: any) => {
    attemptCount: number;
    limit: number | null;
    limitReached: boolean;
    bestScore: number | null;
    maxScore: number | null;
    bestPercentage: number;
  };
  selectedTestHistory: any[];
  onBackNavigation?: (nav: { label: string; onBack: () => void } | undefined) => void;
  onResumeAttempt: (attempt: any) => void;
}

export function MockTestView({
  profile,
  pastExams,
  briefingChecklist,
  onToggleChecklistItem,
  isStarting,
  hasActiveExam,
  isEligible,
  onStartExam,
  exams,
  selectedExam,
  selectedExamDetails,
  onSelectExam,
  getExamAttemptInfo,
  selectedTestHistory,
  onBackNavigation,
  onResumeAttempt,
}: MockTestViewProps) {
  const [showSelection, setShowSelection] = useState(true);

  // Synchronize back navigation in the header
  useEffect(() => {
    if (!onBackNavigation) return;

    if (!showSelection) {
      onBackNavigation({
        label: 'Back to Tests',
        onBack: () => setShowSelection(true)
      });
    } else {
      onBackNavigation(undefined);
    }

    return () => {
      onBackNavigation(undefined);
    };
  }, [showSelection, onBackNavigation]);

  // View 1: Test selection screen (shown when no exam selected or user clicks "Change Test")
  if (showSelection) {
    return (
      <TestSelectionView
        profile={profile}
        exams={exams}
        selectedExam={selectedExam}
        onSelectExam={onSelectExam}
        pastExams={pastExams}
        selectedTestHistory={selectedTestHistory}
        onStartBriefing={() => setShowSelection(false)}
        onResumeAttempt={onResumeAttempt}
      />
    );
  }

  // View 2: Briefing view with history and radar chart for selected exam
  const selectedAttemptInfo = getExamAttemptInfo(selectedExam);
  const isAttemptLimitReached = selectedAttemptInfo.limitReached;

  return (
    <div className="h-full w-full mx-auto overflow-hidden">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] h-full">
        <section className="flex min-w-0 flex-col gap-4 h-full overflow-hidden">
          <KniCard className="overflow-y-auto p-0">
            <div className="border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                  <ClipboardCheck className="size-3.5" />
                  Mock Test Briefing
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] transition ${isEligible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  {isEligible ? (
                    <>
                      <Check className="size-3.5" />
                      You are eligible
                    </>
                  ) : (
                    <>
                      <X className="size-3.5" />
                      Access restricted
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600 shadow-xs">
                  {selectedExam.format === 'Paper' ? <FilePenLine className="size-6" /> : <Laptop className="size-6"/>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                    {selectedExam.major ? MODULE_TEST_LABELS[selectedExam.major] : "Core Module"}
                  </p>
                  <h2 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {selectedExam.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {selectedAttemptInfo.attemptCount > 0 && selectedAttemptInfo.bestScore !== null ? (
                      `Your best score is ${selectedAttemptInfo.bestPercentage}%. Review the setup below before beginning a timed attempt.`
                    ) : (
                      'Review the setup below before beginning a timed attempt.'
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Preparation checklist</p>
                  <h3 className="text-xl font-black tracking-tight text-slate-950">Get ready to focus</h3>
                  <p className="text-xs font-medium text-orange-600 mt-0.5 animate-pulse">Click each requirement below to confirm.</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] ${briefingChecklist.length === 5 ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200/35' : 'bg-amber-500/10 text-amber-700 border border-amber-200/35'}`}>
                  {briefingChecklist.length} of 5 ready
                </span>
              </div>
              <div className="grid gap-3">
                {CHECKLIST_ITEMS.map(item => {
                  const checked = briefingChecklist.includes(item.id);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => onToggleChecklistItem(item.id)}
                      className={`group flex w-full items-start gap-3 rounded-2xl border py-3 px-4 text-left transition cursor-pointer ${
                        checked
                          ? 'border-emerald-200 bg-emerald-50/80 shadow-xs'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl transition ${
                        checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1 self-center">
                        <span className={`block text-sm font-black transition ${checked ? 'text-emerald-800' : 'text-slate-900'}`}>{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                      </span>
                      <div className="flex items-center justify-center shrink-0 self-center">
                        <div className={`flex size-5 items-center justify-center rounded-md border-2 transition-all duration-205 ${
                          checked
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs'
                            : 'border-slate-300 bg-white group-hover:border-slate-400'
                        }`}>
                          {checked && <Check className="size-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </KniCard>
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          {/* Change Test Button */}
          {/* <div className="flex justify-center">
            <KniButton
              variant="secondary"
              onClick={() => setShowSelection(true)}
              className="h-10 px-4 text-xs font-semibold rounded-xl"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              Select a Different Test
            </KniButton>
          </div> */}

          <KniCard className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Attempt overview</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Exam details</h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <FileText className="size-5" />
              </div>
            </div>

            <div className="divide-y divide-slate-100 mt-5">
              <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                <span className="text-xs font-medium text-slate-500">Sections</span>
                <span className="text-right text-xs font-black text-slate-950">
                  {selectedExamDetails?.isLoading ? (
                    <span className="text-slate-400">Loading...</span>
                  ) : (
                    `${selectedExamDetails?.sectionsCount || 0} sections`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Questions</span>
                <span className="text-right text-xs font-black text-slate-950">
                  {selectedExamDetails?.isLoading ? (
                    <span className="text-slate-400">Loading...</span>
                  ) : (
                    `${selectedExamDetails?.questionsCount || 0} questions`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Time</span>
                <span className="text-right text-xs font-black text-slate-950">
                  {selectedExamDetails?.isLoading ? (
                    <span className="text-slate-400">Loading...</span>
                  ) : (
                    (() => {
                      const totalMinutes = selectedExamDetails?.totalDurationMinutes || 0;
                      if (!totalMinutes) return 'N/A';
                      const hrs = Math.floor(totalMinutes / 60);
                      const mins = totalMinutes % 60;
                      if (hrs === 0) return `~${mins}m`;
                      if (mins === 0) return `~${hrs} hours`;
                      return `~${hrs}h ${mins}m`;
                    })()
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Scoring</span>
                <span className="text-right text-xs font-black text-slate-950">1 point per correct answer</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
                <span className="text-xs font-medium text-slate-500">Format</span>
                <span className="text-right text-xs font-black text-slate-950">{profile?.format || 'Digital'}</span>
              </div>
            </div>
          </KniCard>



          <KniCard className="p-5 sm:p-6">
            <div className={`rounded-2xl border p-4 ${isEligible ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}>
              <div className="flex items-start gap-3">
                <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${isEligible ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {isEligible ? <ShieldCheck className="size-5" /> : <X className="size-5" />}
                </div>
                <div>
                  <p className={`text-sm font-black ${isEligible ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {isEligible ? 'Eligibility confirmed' : 'Access restricted'}
                  </p>
                  <p className="mt-0.5 text-xs leading-normal text-slate-600">
                    {isEligible ? (
                      `Your approved ${selectedExam.major ? MODULE_TEST_LABELS[selectedExam.major] : "Core"} allocation includes this ${(profile?.format || 'Digital').toLowerCase()} mock test.`
                    ) : (
                      !hasActiveExam ? 'No active exam is scheduled.' : `Your attempts limit (${selectedAttemptInfo.limit}) is exhausted.`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <KniButton
              type="button"
              disabled={briefingChecklist.length !== 5 || isStarting || !hasActiveExam || isAttemptLimitReached}
              onClick={onStartExam}
              className="mt-5 flex w-full h-11 px-4 text-sm font-semibold rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {isStarting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </div>
              ) : !hasActiveExam ? (
                'No Active Exam'
              ) : isAttemptLimitReached ? (
                'Retakes Exhausted'
              ) : (
                <>
                  <Timer className="size-5" />
                  Start Mock Test
                  <ChevronRight className="size-5" />
                </>
              )}
            </KniButton>
            <p className="mt-3 text-center text-xs text-rose-600 font-medium">Once started, the timer cannot be paused.</p>
            {briefingChecklist.length !== 5 && hasActiveExam && !isAttemptLimitReached && (
              <p className="mt-2 text-center text-xs text-slate-500 font-medium">
                Complete {5 - briefingChecklist.length} more preparation item{5 - briefingChecklist.length === 1 ? '' : 's'} to continue.
              </p>
            )}
          </KniCard>
        </aside>
      </div>
    </div>
  );
}

// --------------- Static checklist data ---------------

const CHECKLIST_ITEMS = [
  {
    id: 'internet',
    label: 'Stable internet connection',
    description: 'Your connection is ready for continuous answer syncing.',
    icon: Wifi,
  },
  {
    id: 'environment',
    label: 'Quiet testing environment',
    description: 'Notifications are muted and interruptions are minimized.',
    icon: Volume2,
  },
  {
    id: 'fullscreen',
    label: 'Full-screen mode ready',
    description: 'You can focus on the exam without switching windows.',
    icon: Maximize2,
  },
  {
    id: 'materials',
    label: 'Material restrictions understood',
    description: 'Only permitted calculators and reference materials are nearby.',
    icon: Calculator,
  },
  {
    id: 'timer',
    label: 'No-pause rule accepted',
    description: 'You understand the timer cannot be paused after starting.',
    icon: Timer,
  },
];
