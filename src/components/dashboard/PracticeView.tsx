'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Blocks,
  FileText,
  Layers,
  Laptop,
  ChevronRight,
  BookOpen,
  Clock,
  ArrowUpRight,
  Search,
  Target,
  Check,
  Flame,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KniCard, KniButton, KniProgress } from '@/components/KniPrimitives';
import { ImageService } from '@/lib/services/image-service';
import { cn } from '@/lib/utils';
import type { Profile, ModuleTestType } from '@/lib/types';
import PracticeFolderView from './PracticeFolderView';
import PracticeSession from './PracticeSession';
import { usePracticeStore } from '@/lib/store/practice-store';
import {
  PAPER_CORE_SUBTESTS,
  DIGITAL_CORE_SUBTESTS,
  PAPER_MODULE_SUBTESTS,
  SUBTEST_TITLES,
  type SubtestDefinition,
  getModuleCategory,
  isDigitalModuleSection,
} from '@/lib/constants';

const SUBTEST_ICON_MAP: Record<SubtestDefinition['iconName'], LucideIcon> = {
  Blocks,
  FileText,
  BookOpen,
  Clock,
  Layers,
  Laptop,
};
import { filterPracticeQuestionsByRating, groupPracticeItemsByPassage } from '@/lib/exam/practice-helpers';

interface PracticeViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
  onBackNavigation?: (nav: { label: string; onBack: () => void } | undefined) => void;
}

interface SubtestCounts {
  easy: number;
  medium: number;
  hard: number;
  total: number;
}

interface DifficultySegment {
  key: keyof Pick<SubtestCounts, 'hard' | 'medium' | 'easy'>;
  label: string;
  className: string;
  hoverClassName: string;
}

export function PracticeView({ profile, activeModule, onBackNavigation }: PracticeViewProps) {
  const imageService = useMemo(() => new ImageService(), []);
  const {
    sections,
    questions,
    passages,
    userRatings,
    userPracticeDates: userPracticeDatesList,
    isLoaded,
    isLoading,
    fetchPracticeData,
    refreshRatings,
  } = usePracticeStore();

  const userPracticeDates = useMemo(
    () => new Set(userPracticeDatesList),
    [userPracticeDatesList]
  );

  const isPaper = (profile?.format || 'Digital').toLowerCase() === 'paper';

  type SubtestType =
    | 'figure_sequence'
    | 'math_equation'
    | 'latin_square'
    | 'solving_quantitative'
    | 'inferring_relationships'
    | 'numerical_series'
    | 'interpreting_texts'
    | 'representation_systems'
    | 'linguistic_structures'
    | 'sc_1'
    | 'sc_2'
    | 'econ_1'
    | 'econ_2'
    | 'eng_1'
    | 'eng_2'
    | 'eng_2_2d'
    | 'eng_2_3d'
    | 'eng_3'
    | 'module_mcq';

  const SUBTEST_KEYWORDS: Record<string, string[]> = {
    sc_1: ['scientific relationships', 'scientific interrelationships', 'analyzing scientific relationships'],
    sc_2: ['formal depictions', 'understanding formal depictions'],
    econ_1: ['economic relationships', 'economic interrelationships', 'analyzing economic relationships'],
    econ_2: ['processes', 'economic processes', 'analyzing processes'],
    eng_1: ['formalising technical', 'formalizing technical', 'technical interrelationships'],
    eng_2: ['visualising solids', 'visualizing solids'],
    eng_2_2d: ['visualising solids - 2d', 'visualizing solids - 2d', 'solids - 2d', 'visualizing solids 2d'],
    eng_2_3d: ['visualising solids - 3d', 'visualizing solids - 3d', 'solids - 3d', 'visualizing solids 3d'],
    eng_3: ['analysing technical', 'analyzing technical', 'technical relationships'],
  };

  const getMatchedSections = useCallback((subtest: SubtestType) => {
    // Module MCQ must be scoped by the shared exam predicate BEFORE any bare
    // question_type match — otherwise every module section leaks in.
    // Digital-only: paper modules use sc_/eng_/econ_ subtests instead.
    if (subtest === 'module_mcq') {
      if (isPaper) return [];
      return sections.filter((s) => isDigitalModuleSection(s, activeModule));
    }

    // 1. Direct question_type match first
    const directMatches = sections.filter((s) => s.question_type === subtest);
    if (directMatches.length > 0) {
      return directMatches;
    }

    // 2. Keyword fallback for module/title based matching
    const keywords = SUBTEST_KEYWORDS[subtest];
    if (keywords) {
      return sections.filter((s) =>
        keywords.some((kw) => s.title.toLowerCase().includes(kw))
      );
    }

    if (
      subtest === 'interpreting_texts' ||
      subtest === 'representation_systems' ||
      subtest === 'linguistic_structures'
    ) {
      return sections.filter((s) => s.question_type === subtest);
    }

    if (subtest === 'figure_sequence') {
      return sections.filter((s) =>
        isPaper
          ? s.question_type === 'completing patterns' || s.title.toLowerCase().includes('completing patterns')
          : s.question_type === 'figure_sequence' && s.title.toLowerCase().includes('figure sequence')
      );
    }

    return sections.filter((s) => s.question_type === subtest);
  }, [sections, activeModule, isPaper]);

  // Navigation State inside SPA
  const [selectedSubtest, setSelectedSubtest] = useState<SubtestType | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubtestId, setSelectedSubtestId] = useState<string | null>(null);

  const handleBackToPractice = useCallback(() => {
    setSelectedSubtest(null);
  }, []);

  // Synchronize back navigation in the header
  useEffect(() => {
    if (!onBackNavigation) return;

    if (selectedSubtest && selectedFolder) {
      onBackNavigation({
        label: 'Back to Folders',
        onBack: () => {
          setSelectedFolder(null);
          setPracticeQuestions([]);
        }
      });
    } else if (selectedSubtest) {
      onBackNavigation({
        label: 'Back to Practice',
        onBack: handleBackToPractice
      });
    } else {
      onBackNavigation(undefined);
    }

    return () => {
      onBackNavigation(undefined);
    };
  }, [selectedSubtest, selectedFolder, onBackNavigation, handleBackToPractice]);

  // Main subtest card list
  const subtests = useMemo(() => {
    const baseDefs = isPaper ? PAPER_CORE_SUBTESTS : DIGITAL_CORE_SUBTESTS;
    const items = baseDefs.map((def) => ({
      id: def.id as SubtestType,
      title: def.title,
      description: def.description,
      icon: SUBTEST_ICON_MAP[def.iconName],
    }));

    if (activeModule) {
      if (isPaper) {
        const category = getModuleCategory(activeModule);
        if (category && PAPER_MODULE_SUBTESTS[category]) {
          PAPER_MODULE_SUBTESTS[category].forEach((def) => {
            items.push({
              id: def.id as SubtestType,
              title: def.title,
              description: def.description,
              icon: SUBTEST_ICON_MAP[def.iconName],
            });
          });
        }
      } else {
        const moduleLabel = activeModule.includes('science') || activeModule === 'CS' ? 'Natural & Computer Science' : activeModule;
        items.push({
          id: 'module_mcq' as const,
          title: `${moduleLabel} Module`,
          description: `Practice subject-specific questions for ${moduleLabel}.`,
          icon: Laptop,
        });
      }
    }

    return items;
  }, [activeModule, isPaper]);

  const getSubtestTitle = useCallback((subtest: SubtestType): string => {
    if (subtest === 'figure_sequence') {
      return isPaper ? SUBTEST_TITLES.figure_sequence_paper : SUBTEST_TITLES.figure_sequence_digital;
    }
    if (subtest === 'module_mcq') {
      return activeModule
        ? (activeModule.includes('science') || activeModule === 'CS' ? 'Natural Science & CS Module' : activeModule)
        : 'Subject Module';
    }
    return SUBTEST_TITLES[subtest] || subtest;
  }, [activeModule, isPaper]);

  // Only count rated questions (unrated questions are hidden in practice)
  const getSubtestCounts = useCallback((subtest: SubtestType): SubtestCounts => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    // Count grouped session items (one per passage, not per child) so folder
    // cards match the number of screens in the session.
    const countFolder = (folder: 'easy' | 'medium' | 'hard'): number =>
      groupPracticeItemsByPassage(
        filterPracticeQuestionsByRating(subtestQuestions, userRatings, folder),
        passages,
      ).length;

    const easy = countFolder('easy');
    const medium = countFolder('medium');
    const hard = countFolder('hard');
    const total = easy + medium + hard;

    return { easy, medium, hard, total };
  }, [getMatchedSections, questions, userRatings, passages]);

  const filteredSubtests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let result = subtests;
    if (normalizedQuery) {
      result = subtests.filter(sub =>
        sub.title.toLowerCase().includes(normalizedQuery) ||
        sub.description.toLowerCase().includes(normalizedQuery)
      );
    }
    // Sort by hard count desc, then medium count desc
    return [...result].sort((a, b) => {
      const countsA = getSubtestCounts(a.id);
      const countsB = getSubtestCounts(b.id);
      if (countsB.hard !== countsA.hard) return countsB.hard - countsA.hard;
      return countsB.medium - countsA.medium;
    });
  }, [searchQuery, subtests, getSubtestCounts]);

  const selectedSubtestData = useMemo(() => {
    return subtests.find(s => s.id === selectedSubtestId) ?? subtests[0];
  }, [subtests, selectedSubtestId]);

  const sectionIdToExamTitle = useMemo(() => {
    const mapping: Record<string, string> = {};
    sections.forEach((s) => {
      const examTitle = Array.isArray(s.exams) ? s.exams[0]?.title : s.exams?.title;
      if (examTitle) {
        mapping[s.id] = examTitle;
      }
    });
    return mapping;
  }, [sections]);

  useEffect(() => {
    if (profile) {
      fetchPracticeData();
    }
  }, [profile, fetchPracticeData]);

  const practiceSubtest = filteredSubtests[0] ?? null;


  // Only show rated questions in practice - hide unrated questions completely
  const getQuestionIdsForFolder = (subtest: SubtestType, folder: 'easy' | 'medium' | 'hard') => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    return filterPracticeQuestionsByRating(subtestQuestions, userRatings, folder)
      .map((q) => q.id);
  };

  const startPracticeSession = async (subtest: SubtestType, folder: 'easy' | 'medium' | 'hard') => {
    setIsLoadingSession(true);
    setSelectedFolder(folder);
    try {
      const targetIds = getQuestionIdsForFolder(subtest, folder);

      if (targetIds.length === 0) {
        setPracticeQuestions([]);
        return;
      }

      const targetSet = new Set(targetIds);
      const allQ = questions.filter((q) => targetSet.has(q.id));

      // Group passage children into one session item per passage (mirrors the
      // exam), preserving encounter order. Only target-folder children are
      // included so folder counts stay accurate.
      const sessionItems = groupPracticeItemsByPassage(allQ, passages);

      const resolved = await imageService.resolveQuestionImageUrls(sessionItems);
      setPracticeQuestions(resolved);
    } catch (err) {
      console.error('Failed to load practice questions:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleExitPracticeSession = () => {
    setSelectedFolder(null);
    setPracticeQuestions([]);
  };

  // Main UI routing

  if (selectedSubtest && selectedFolder) {
    if (isLoadingSession) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500"></div>
        </div>
      );
    }

    return (
      <PracticeSession
        subtestType={selectedSubtest}
        subtestTitle={getSubtestTitle(selectedSubtest)}
        folderId={selectedFolder}
        questions={practiceQuestions}
        userId={profile?.id || ''}
        userEmail={profile?.email || ''}
        userFullName={profile?.full_name}
        onExit={handleExitPracticeSession}
        onQuestionRated={() => void refreshRatings()}
        isPaper={isPaper}
        isPracticeOnly={true}
      />
    );
  }

  if (selectedSubtest) {
    const counts = getSubtestCounts(selectedSubtest);

    return (
      <PracticeFolderView
        subtestTitle={getSubtestTitle(selectedSubtest)}
        counts={counts}
        onBack={handleBackToPractice}
        onSelectFolder={(folder) => startPracticeSession(selectedSubtest, folder)}
      />
    );
  }

  if (!isLoaded && isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-12 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500"></div>
      </div>
    );
  }

  const getOverallStats = () => {
    let totalQuestions = 0;
    let totalEasy = 0;
    let totalMedium = 0;
    let totalHard = 0;

    let activeModuleTotal = 0;
    let activeModuleEasy = 0;
    let activeModuleMedium = 0;
    let activeModuleHard = 0;

    subtests.forEach((sub) => {
      const counts = getSubtestCounts(sub.id);

      totalQuestions += counts.total;
      totalEasy += counts.easy;
      totalMedium += counts.medium;
      totalHard += counts.hard;

      const isModuleSub = ![
        'figure_sequence',
        'math_equation',
        'latin_square',
        'solving_quantitative',
        'inferring_relationships',
        'numerical_series',
      ].includes(sub.id);

      if (isModuleSub) {
        activeModuleTotal += counts.total;
        activeModuleEasy += counts.easy;
        activeModuleMedium += counts.medium;
        activeModuleHard += counts.hard;
      }
    });

    const totalRated = totalEasy + totalMedium + totalHard;
    const activeModuleRated = activeModuleEasy + activeModuleMedium + activeModuleHard;

    return {
      totalQuestions,
      totalEasy,
      totalMedium,
      totalHard,
      totalRated,
      activeModuleTotal,
      activeModuleEasy,
      activeModuleMedium,
      activeModuleHard,
      activeModuleRated,
    };
  };

  const overallStats = getOverallStats();

  const difficultySegments: DifficultySegment[] = [
    {
      key: 'hard',
      label: 'Hard',
      className: 'bg-rose-500',
      hoverClassName: 'group-hover:bg-rose-600',
    },
    {
      key: 'medium',
      label: 'Medium',
      className: 'bg-amber-400',
      hoverClassName: 'group-hover:bg-amber-500',
    },
    {
      key: 'easy',
      label: 'Easy',
      className: 'bg-emerald-500',
      hoverClassName: 'group-hover:bg-emerald-600',
    },
  ];

  const overallProgressPercent = overallStats.totalQuestions > 0
    ? (overallStats.totalRated / overallStats.totalQuestions) * 100
    : 0;

  const totalQuestions = overallStats.totalQuestions || 1;
  const totalEasyQs = Math.floor(totalQuestions * 0.3) || 1;
  const totalMediumQs = Math.floor(totalQuestions * 0.5) || 1;
  const totalHardQs = (totalQuestions - totalEasyQs - totalMediumQs) || 1;

  const easyRatio = Math.min(overallStats.totalEasy / totalEasyQs, 1);
  const mediumRatio = Math.min(overallStats.totalMedium / totalMediumQs, 1);
  const hardRatio = Math.min(overallStats.totalHard / totalHardQs, 1);

  const selectedActivity = filteredSubtests.length > 0
    ? filteredSubtests[0]
    : { label: 'Start your first practice session', percentage: 0, total: 0, correct: 0 };

  // Helper: calculate streaks and weekly activity
  const getStreakAndActivity = () => {
    const sortedDates = Array.from(userPracticeDates).sort();
    if (sortedDates.length === 0) return { currentStreak: 0, maxStreak: 0, weekCheckedIn: Array(7).fill(false), weeklyActiveCount: 0 };

    // Calculate max streak
    let maxStreak = 0;
    let currentRun = 0;
    let prevDate: Date | null = null;

    // Convert date strings back to local Date objects (just date parts, ignoring time)
    const parsedDates = sortedDates.map(d => new Date(d + 'T00:00:00'));

    parsedDates.forEach(date => {
      if (!prevDate) {
        currentRun = 1;
      } else {
        const diffTime = date.getTime() - prevDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentRun++;
        } else if (diffDays > 1) {
          maxStreak = Math.max(maxStreak, currentRun);
          currentRun = 1;
        }
      }
      prevDate = date;
    });
    maxStreak = Math.max(maxStreak, currentRun);

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    if (userPracticeDates.has(todayStr) || userPracticeDates.has(yesterdayStr)) {
      // Start counting back from whichever date is active (today or yesterday)
      const checkDate = userPracticeDates.has(todayStr) ? new Date() : yesterday;
      while (true) {
        const checkStr = checkDate.toLocaleDateString('en-CA');
        if (userPracticeDates.has(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate weekly checked-in days (Monday to Sunday of the current week)
    // Find the Monday of the current week
    const curr = new Date();
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(curr.setDate(diff));

    const weekCheckedIn = Array(7).fill(false);
    let weeklyActiveCount = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      if (userPracticeDates.has(dateStr)) {
        weekCheckedIn[i] = true;
        weeklyActiveCount++;
      }
    }

    return { currentStreak, maxStreak, weekCheckedIn, weeklyActiveCount };
  };

  const { currentStreak, maxStreak, weekCheckedIn, weeklyActiveCount } = getStreakAndActivity();

  const selectedSubtestCounts = selectedSubtestId ? getSubtestCounts(selectedSubtestId as SubtestType) : null;
  const selectedSubtestPercent = selectedSubtestCounts && selectedSubtestCounts.total > 0
    ? Math.round((selectedSubtestCounts.easy + selectedSubtestCounts.medium + selectedSubtestCounts.hard) / selectedSubtestCounts.total * 100)
    : 0;

  return (
    <div className="w-full max-w-[1480px] mx-auto">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="flex min-w-0 flex-col gap-4">
          {/* Recommended Next Card */}
          <KniCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600">
              <Target className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Recommended next
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="truncate text-base font-black text-slate-950">
                  {practiceSubtest
                    ? practiceSubtest.title
                    : 'Start your first practice session'}
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {overallStats.totalRated > 0
                    ? `Still ${overallStats.totalHard} hard questions to practice`
                    : 'Ready for your first session'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <KniButton
                onClick={() => practiceSubtest && setSelectedSubtest(practiceSubtest.id)}
                className="h-11 px-5 text-sm"
              >
                Practice
                <ChevronRight className="size-4" />
              </KniButton>
            </div>
          </KniCard>

          {/* Practice List with Search */}
          <section>
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">
                  Your study plan
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Recommended practice
                </h2>
              </div>

              {/* <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-orange-300 focus-within:text-orange-600">
                <Search className="size-4" />
                <span className="sr-only">Search practice areas</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Find a practice area"
                  className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 sm:w-44"
                />
              </label> */}
            </div>

            <KniCard className="p-0">
              {filteredSubtests.length > 0 ? filteredSubtests.map((sub) => {
                const Icon = sub.icon;
                const counts = getSubtestCounts(sub.id);
                const selected = selectedSubtestId === sub.id;
                const percent = counts.total > 0
                  ? Math.round((counts.easy + counts.medium + counts.hard) / counts.total * 100)
                  : 0;

                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedSubtest(sub.id)}
                    className={cn(
                      'flex w-full items-center gap-4 border-b border-slate-100 p-4 text-left transition last:border-b-0 sm:p-5',
                      selected ? 'bg-orange-50/10' : 'hover:bg-slate-50/50',
                    )}
                  >
                    <div className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-full',
                      selected ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-650',
                    )}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">{sub.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            {counts.total > 0 ? (
                              <>
                                <span className="flex items-center gap-1 text-xs font-medium">
                                  <span className="text-rose-500">{counts.hard} HARD</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-amber-500">{counts.medium} MEDIUM</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-emerald-500">{counts.easy} EASY</span>
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">No rated questions</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </button>
                );
              }) : (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-slate-700">No matching practice area</p>
                  <p className="mt-1 text-xs text-slate-400">Try a shorter search term.</p>
                </div>
              )}
            </KniCard>
          </section>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">

                    {/* Activity Streak Card */}
          {/* <KniCard className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Activity Streak
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {currentStreak} day streak
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <Flame className="size-5" />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-black text-slate-950">{currentStreak}</span>
                  <span className="text-sm font-bold text-orange-600">day streak</span>
                </div>
              </div>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Max Streak: {maxStreak} days
            </p>
          </KniCard> */}

          {/* Subtests by Question Difficulty */}
          <KniCard className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Study Focus
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Question breakdown
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <Flame className="size-5" />
              </div>
            </div>

            {/* Horizontal Stacked Bar Chart */}
            <div className="mt-4 flex flex-col gap-2">
              {(() => {
                // Calculate counts for all subtests
                const subtestWithCounts = subtests.map((sub) => {
                  const counts = getSubtestCounts(sub.id);
                  return { sub, counts };
                });

                // Sort urgent practice first: most hard, then medium, then easy.
                subtestWithCounts.sort((a, b) => {
                  if (b.counts.hard !== a.counts.hard) return b.counts.hard - a.counts.hard;
                  if (b.counts.medium !== a.counts.medium) return b.counts.medium - a.counts.medium;
                  return b.counts.easy - a.counts.easy;
                });

                return subtestWithCounts.map(({ sub, counts }) => {
                  const total = counts.easy + counts.medium + counts.hard;
                  const countLabel = `${counts.hard} hard, ${counts.medium} medium, ${counts.easy} easy`;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubtest(sub.id)}
                      aria-label={`${sub.title}: ${countLabel}`}
                      className="group grid w-full grid-cols-[240px_1fr] items-center gap-3 rounded-md px-1 py-1.5 text-left transition hover:bg-slate-50"
                    >
                      <p className="min-w-0 text-xs font-black leading-snug text-slate-700 group-hover:text-orange-600">
                        {sub.title}
                      </p>
                      <div
                        className="relative h-5 min-w-0 overflow-hidden rounded-full bg-slate-100"
                        style={{
                          backgroundImage:
                            'linear-gradient(to right, rgba(148, 163, 184, 0.38) 1px, transparent 1px)',
                          backgroundSize: '10% 100%',
                        }}
                      >
                        <div className="absolute inset-0 flex overflow-hidden rounded-full">
                          {total > 0 ? (
                            <>
                              {difficultySegments.map((segment) => {
                                const count = counts[segment.key];
                                if (count === 0) return null;

                                return (
                                  <div
                                    key={segment.key}
                                    className={cn(
                                      'h-full transition-all duration-500',
                                      segment.className,
                                      segment.hoverClassName,
                                    )}
                                    style={{ width: `${(count / total) * 100}%` }}
                                    title={`${segment.label}: ${count}`}
                                  />
                                );
                              })}
                            </>
                          ) : (
                            <div className="h-full w-full bg-slate-100" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-100 pt-3">
              {difficultySegments.map((segment) => (
                <div key={segment.key} className="flex items-center gap-2">
                  <span className={cn('size-2.5 rounded-full', segment.className)} />
                  <span className="text-[11px] font-bold text-slate-500">{segment.label}</span>
                </div>
              ))}
            </div>
          </KniCard>

          {/* Overall Progress Card */}
          {/* <KniCard className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Overall Progress
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {Math.round(overallProgressPercent)}% completion
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <Check className="size-5" />
              </div>
            </div>

            <KniProgress value={overallProgressPercent} className="mt-5 h-3" />

            <div className="mt-5 text-sm text-slate-500">
              You have rated {overallStats.totalRated} out of {overallStats.totalQuestions} questions.
            </div>
          </KniCard> */}
        </aside>
      </div>
    </div>
  );
}
