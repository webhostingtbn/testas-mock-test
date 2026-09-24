'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Timer,
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Blocks,
  FileText,
  BookOpen,
  Clock,
  Layers,
  Laptop,
  HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KniButton } from '@/components/KniPrimitives';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Profile, ModuleTestType } from '@/lib/types';
import type { ExamAttemptReview } from './ReviewView';
import { usePracticeStore, type PracticeSection } from '@/lib/store/practice-store';
import {
  PAPER_CORE_SUBTESTS,
  DIGITAL_CORE_SUBTESTS,
  PAPER_MODULE_SUBTESTS,
  SUBTEST_TITLES,
  type SubtestDefinition,
  getModuleCategory,
} from '@/lib/constants';

const SUBTEST_ICON_MAP: Record<SubtestDefinition['iconName'], LucideIcon> = {
  Blocks,
  FileText,
  BookOpen,
  Clock,
  Layers,
  Laptop,
};

interface SectionScoreStat {
  correct: number;
  total: number;
  pct: number;
}

interface SubtestDrillsViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
  pastExams: ExamAttemptReview[];
  onStartDrill: (examId: string, sectionId: string) => Promise<void>;
  onResumeAttempt: (attempt: ExamAttemptReview) => void;
  onReviewAttempt: (attempt: ExamAttemptReview) => void;
  isStarting: boolean;
}

function getExamTitleFromSection(section: PracticeSection, fallbackIndex: number): string {
  if (section.exams && typeof section.exams === 'object' && 'title' in section.exams && typeof section.exams.title === 'string') {
    return section.exams.title;
  }
  return `Test ${fallbackIndex + 1}`;
}

export function SubtestDrillsView({
  profile,
  activeModule,
  pastExams,
  onStartDrill,
  onResumeAttempt,
  onReviewAttempt,
  isStarting,
}: SubtestDrillsViewProps) {
  const { sections, isLoaded, isLoading, fetchPracticeData } = usePracticeStore();
  const [selectedSubtestId, setSelectedSubtestId] = useState<string | null>(null);
  const [startingSectionId, setStartingSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded && !isLoading) {
      fetchPracticeData();
    }
  }, [isLoaded, isLoading, fetchPracticeData]);

  const isPaper = (profile?.format || 'Digital').toLowerCase() === 'paper';

  // Applicable Subtest categories for user
  const applicableSubtests = useMemo<SubtestDefinition[]>(() => {
    const core = isPaper ? PAPER_CORE_SUBTESTS : DIGITAL_CORE_SUBTESTS;
    let moduleDefs: SubtestDefinition[] = [];

    if (isPaper) {
      const cat = getModuleCategory(activeModule);
      if (cat && PAPER_MODULE_SUBTESTS[cat]) {
        moduleDefs = PAPER_MODULE_SUBTESTS[cat];
      }
    } else if (activeModule) {
      const moduleLabel =
        activeModule.includes('science') || activeModule === 'CS'
          ? 'Natural & Computer Science'
          : activeModule;
      moduleDefs = [
        {
          id: 'module_mcq',
          title: `${moduleLabel} Module`,
          description: `Practice subject-specific questions for ${moduleLabel}.`,
          iconName: 'Laptop',
        },
      ];
    }

    return [...core, ...moduleDefs];
  }, [isPaper, activeModule]);

  // Set default selected subtest once loaded
  useEffect(() => {
    if (applicableSubtests.length > 0 && !selectedSubtestId) {
      setSelectedSubtestId(applicableSubtests[0].id);
    }
  }, [applicableSubtests, selectedSubtestId]);

  // Map section ID -> Best score from past attempts
  const sectionStats = useMemo(() => {
    const bestScores = new Map<string, SectionScoreStat>();
    const activeDrills = new Map<string, ExamAttemptReview>();
    const completedDrills = new Map<string, ExamAttemptReview>();

    for (const attempt of pastExams) {
      if (attempt.status === 'in_progress' && attempt.attempt_kind === 'drill') {
        const secId = attempt.section_ids?.[0];
        if (secId && !activeDrills.has(secId)) {
          activeDrills.set(secId, attempt);
        }
      }

      if (attempt.status === 'completed') {
        if (attempt.attempt_kind === 'drill') {
          const secId = attempt.section_ids?.[0];
          if (secId && !completedDrills.has(secId)) {
            completedDrills.set(secId, attempt);
          }
        }

        for (const sec of attempt.section_scores ?? []) {
          if (!sec.total || sec.total <= 0) continue;
          const pct = Math.round((sec.correct / sec.total) * 100);
          const current = bestScores.get(sec.key);
          if (!current || pct > current.pct) {
            bestScores.set(sec.key, {
              correct: sec.correct,
              total: sec.total,
              pct,
            });
          }
        }
      }
    }

    return { bestScores, activeDrills, completedDrills };
  }, [pastExams]);

  // Helper to match sections belonging to a subtest
  const getSectionsForSubtest = (subtestId: string): PracticeSection[] => {
    return sections
      .filter((s) => {
        if (subtestId === 'figure_sequence') {
          return isPaper
            ? s.question_type === 'completing_patterns'
            : s.question_type === 'figure_sequence';
        }
        return s.question_type === subtestId;
      })
      .sort((a, b) => {
        const titleA = getExamTitleFromSection(a, 0);
        const titleB = getExamTitleFromSection(b, 0);
        return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
      });
  };

  const handleStart = async (examId: string, sectionId: string) => {
    setStartingSectionId(sectionId);
    try {
      await onStartDrill(examId, sectionId);
    } catch {
      toast.error('Failed to start drill. Please try again.');
    } finally {
      setStartingSectionId(null);
    }
  };

  const currentSubtest = applicableSubtests.find((s) => s.id === selectedSubtestId) ?? applicableSubtests[0];
  const availableSections = currentSubtest ? getSectionsForSubtest(currentSubtest.id) : [];

  return (
    <div className="mx-auto p-4 sm:px-0 flex w-full flex-col gap-6 pb-12">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-linear-to-r from-orange-500/10 via-amber-500/5 to-transparent p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold tracking-wider text-orange-700 uppercase">
                <Timer className="size-3.5" />
                Targeted Practice
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                {isPaper ? 'Paper Format' : 'Digital Format'}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Subtest Drills
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Practice individual subtests under official time limits without consuming your mock exam quota.
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left Subtest Category Selector */}
        <aside className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Select a Subtest
          </p>
          <div className="flex flex-col gap-1.5">
            {applicableSubtests.map((subtest) => {
              const isSelected = subtest.id === selectedSubtestId;
              const subtestSections = getSectionsForSubtest(subtest.id);
              const Icon = SUBTEST_ICON_MAP[subtest.iconName] || Laptop;

              return (
                <button
                  key={subtest.id}
                  onClick={() => setSelectedSubtestId(subtest.id)}
                  className={cn(
                    'group flex items-center justify-between rounded-2xl border p-3.5 text-left transition cursor-pointer',
                    isSelected
                      ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl transition',
                        isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-bold', isSelected ? 'text-orange-950' : 'text-slate-900')}>
                        {subtest.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {subtestSections.length} tests available
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn('size-4 transition', isSelected ? 'text-orange-600' : 'text-slate-400')}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Test Sections List */}
        <section className="flex flex-col gap-4">
          {currentSubtest && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col gap-1 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-black text-slate-950">
                  {SUBTEST_TITLES[currentSubtest.id] || currentSubtest.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {currentSubtest.description}
                </p>
              </div>

              {availableSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <HelpCircle className="size-6" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">No test sections found</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    No active tests currently contain this subtest for your profile format.
                  </p>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-3">
                  {availableSections.map((sec, idx) => {
                    const examTitle = getExamTitleFromSection(sec, idx);
                    const stats = sectionStats.bestScores.get(sec.id);
                    const activeDrill = sectionStats.activeDrills.get(sec.id);
                    const completedDrill = sectionStats.completedDrills.get(sec.id);
                    const isBusy = startingSectionId === sec.id || isStarting;
                    const durationMins = Math.round((sec.duration_seconds || 1800) / 60);

                    return (
                      <div
                        key={sec.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100/60 font-black text-orange-700 text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {examTitle}
                            </h4>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{sec.question_count ?? 22} questions</span>
                              <span>•</span>
                              <span>{durationMins} minutes</span>
                              {stats && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                                    <CheckCircle2 className="size-3" />
                                    Best: {stats.pct}% ({stats.correct}/{stats.total})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {activeDrill ? (
                            <KniButton
                              onClick={() => onResumeAttempt(activeDrill)}
                              className="h-9 gap-1.5 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                            >
                              <RotateCcw className="size-3.5" />
                              Resume Drill
                            </KniButton>
                          ) : (
                            <>
                              {completedDrill && onReviewAttempt && (
                                <KniButton
                                  variant="secondary"
                                  onClick={() => onReviewAttempt(completedDrill)}
                                  className="h-9 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                  Review
                                </KniButton>
                              )}
                              <KniButton
                                onClick={() => handleStart(sec.exam_id, sec.id)}
                                disabled={isBusy}
                                className="h-9 gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-bold text-white hover:bg-orange-500 cursor-pointer disabled:opacity-50"
                              >
                                <PlayCircle className="size-3.5" />
                                {stats ? 'Retake Drill' : 'Start Drill'}
                              </KniButton>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
