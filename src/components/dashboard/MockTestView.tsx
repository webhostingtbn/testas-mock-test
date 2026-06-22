"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ClipboardCheck, Check, X, Timer, FileText, ShieldCheck,
  Wifi, Volume2, Maximize2, Calculator, ChevronRight, ChevronLeft
} from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';
import type { Profile, ModuleTestType } from '@/lib/types';

interface MockTestViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
  pastExams: any[];
  examLimit: number | null;
  isAdmin: boolean;
  briefingChecklist: string[];
  onToggleChecklistItem: (id: string) => void;
  isStarting: boolean;
  hasActiveExam: boolean;
  isEligible: boolean;
  onStartExam: () => void;
  exams: any[];
  selectedExam: any | null;
  onSelectExam: (exam: any | null) => void;
  getExamAttemptInfo: (exam: any) => {
    attemptCount: number;
    limit: number | null;
    limitReached: boolean;
    bestScore: number | null;
    maxScore: number | null;
    bestPercentage: number;
  };
  radarStats: {
    key: string;
    label: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
  onViewChange: (view: any) => void;
}

export function MockTestView({
  profile,
  activeModule,
  pastExams,
  examLimit,
  isAdmin,
  briefingChecklist,
  onToggleChecklistItem,
  isStarting,
  hasActiveExam,
  isEligible,
  onStartExam,
  exams,
  selectedExam,
  onSelectExam,
  getExamAttemptInfo,
  radarStats,
  onViewChange,
}: MockTestViewProps) {
  
  // View 1: If no exam is selected for briefing (meaning no active exams are configured)
  if (!selectedExam) {
    return (
      <div className="mx-auto w-full ">
        <div className="mb-8">
          <p className="text-sm font-medium text-orange-700">Mock Test Center</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900">Simulate the real exam</h2>
          <p className="mt-2 text-slate-500 max-w-2xl">
            Test your skills under real-time constraints.
          </p>
        </div>

        <KniCard className="p-8 border border-dashed border-orange-100/50 flex flex-col items-center justify-center text-center bg-orange-50/10 rounded-2xl py-16">
          <Timer className="size-10 text-orange-300 mb-3" />
          <h4 className="text-base font-bold text-slate-800">No active mock exams available</h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
            There is currently no active mock test configured in the system. Please check back later or contact an administrator.
          </p>
          <KniButton
            onClick={() => onViewChange('dashboard')}
            className="mt-5 h-9 px-4 text-xs font-semibold"
          >
            Go Back to Dashboard
          </KniButton>
        </KniCard>
      </div>
    );
  }

  // View 2: If an exam is selected, show briefing checklist
  const selectedAttemptInfo = getExamAttemptInfo(selectedExam);
  const isAttemptLimitReached = selectedAttemptInfo.limitReached;

  return (
    <div className="mx-auto w-full">
      <button 
        onClick={() => onViewChange('dashboard')} 
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold mb-6 cursor-pointer transition"
      >
        <ChevronLeft className="size-4" />
        Back to Dashboard
      </button>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4">
          <KniCard className="overflow-hidden p-0 bg-white/80 backdrop-blur-md">
            <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 md:py-4.5 md:px-5">
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-orange-700">
                  <ClipboardCheck className="size-3.5" />
                  Mock Test Briefing
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${isEligible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
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
                <div className="grid size-12 shrink-0 place-items-center rounded-xl shadow-xs bg-orange-600/10 text-orange-600">
                  <Timer className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                    {selectedExam.major ? MODULE_TEST_LABELS[selectedExam.major] : "Core Module"}
                  </p>
                  <h2 className="mt-0.5 text-2xl font-bold text-slate-900 md:text-3xl">
                    {selectedExam.title}
                  </h2>
                  <p className="mt-1 text-slate-500 text-xs leading-relaxed">
                    {selectedAttemptInfo.attemptCount > 0 && selectedAttemptInfo.bestScore !== null ? (
                      `Your best score is ${selectedAttemptInfo.bestPercentage}%. Review the setup below before beginning a timed attempt.`
                    ) : (
                      'Review the setup below before beginning a timed attempt.'
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preparation checklist</p>
                  <h3 className="text-xl font-bold text-slate-900">Get ready to focus</h3>
                  <p className="text-xs text-orange-600 font-medium mt-0.5 animate-pulse">Click each requirement below to confirm.</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${briefingChecklist.length === 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {briefingChecklist.length} of 5 ready
                </span>
              </div>
              <div className="grid gap-2">
                {CHECKLIST_ITEMS.map(item => {
                  const checked = briefingChecklist.includes(item.id);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => onToggleChecklistItem(item.id)}
                      className={`group flex w-full items-start gap-3 rounded-xl border py-2 px-3 text-left transition cursor-pointer ${
                        checked 
                          ? 'border-emerald-250 bg-emerald-50/80 shadow-xs' 
                          : 'border-orange-100 bg-white/70 hover:border-orange-200 hover:bg-orange-50/70'
                      }`}
                    >
                      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg transition ${
                        checked ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'
                      }`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 self-center">
                        <span className={`block text-sm font-semibold transition ${checked ? 'text-emerald-800' : 'text-slate-900'}`}>{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                      </span>
                      <div className="flex items-center justify-center shrink-0 self-center ml-2">
                        <div className={`flex size-5 items-center justify-center rounded-md border-2 transition-all duration-205 ${
                          checked 
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs' 
                            : 'border-slate-300 bg-white group-hover:border-orange-400'
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
        </div>
        
        <div className="space-y-4">
          <KniCard className="p-4 md:p-5 bg-white/80 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-orange-100 text-orange-700">
                <FileText className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attempt overview</p>
                <h3 className="text-lg font-bold text-slate-900">Exam details</h3>
              </div>
            </div>
            <div className="divide-y divide-orange-100">
              <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                <span className="text-xs font-medium text-slate-500">Sections</span>
                <span className="text-right text-xs font-semibold text-slate-900">4 sections</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Questions</span>
                <span className="text-right text-xs font-semibold text-slate-900">80 questions</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Time limit</span>
                <span className="text-right text-xs font-semibold text-slate-900">~4 hours</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-500">Scoring</span>
                <span className="text-right text-xs font-semibold text-slate-900">1 point per correct answer</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
                <span className="text-xs font-medium text-slate-500">Format</span>
                <span className="text-right text-xs font-semibold text-slate-900">{profile?.format || 'Digital'}</span>
              </div>
            </div>
          </KniCard>
          
          <KniCard className="p-4 md:p-5 bg-white/80 backdrop-blur-md">
            <div className={`rounded-xl border p-3 ${isEligible ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}>
              <div className="flex items-start gap-2.5">
                <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${isEligible ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {isEligible ? <ShieldCheck className="size-4.5" /> : <X className="size-4.5" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isEligible ? 'text-emerald-800' : 'text-rose-800'}`}>
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-300! disabled:text-slate-500 disabled:shadow-none"
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
                  <Timer className="size-4.5" />
                  Start Mock Test
                  <ChevronRight className="size-4.5" />
                </>
              )}
            </KniButton>
            <p className="mt-2 text-center text-xs text-rose-600 font-medium">Once started, the timer cannot be paused.</p>
            {briefingChecklist.length !== 5 && hasActiveExam && !isAttemptLimitReached && (
              <p className="mt-1.5 text-center text-[11px] text-slate-500 font-medium">
                Complete {5 - briefingChecklist.length} more preparation item{5 - briefingChecklist.length === 1 ? '' : 's'} to continue.
              </p>
            )}
          </KniCard>
        </div>
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
