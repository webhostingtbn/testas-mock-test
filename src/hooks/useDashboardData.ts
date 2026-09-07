"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useExamStore } from '@/lib/store/exam-store';
import {
  BREAK_DURATION_TIME_OF_TEST,
  filterSections,
} from '@/lib/constants';
import type { Profile, ModuleTestType, Exam } from '@/lib/types';
import { isFullCompletion } from '@/lib/types';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useExamOrchestrator } from '@/lib/exam/orchestrator';
import { usePracticeStore } from '@/lib/store/practice-store';

interface PastExam {
  id: string;
  user_id: string;
  exam_id: string;
  status: string;
  completion_reason?: string | null;
  answered_count?: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_score: number | null;
  max_score: number | null;
  exams?: { format?: string };
  detailed_results?: unknown;
  user_answers?: unknown;
  updated_at?: string;
  exam_format?: string | null;
  section_scores?: Array<{
    key: string;
    label: string;
    correct: number;
    total: number;
    answers: Array<{
      question_id: string;
      is_correct: boolean;
      is_answered: boolean;
    }>;
  }>;
}

interface RadarStat {
  key: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
}

export function useDashboardData(session: Session) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [pastExams, setPastExams] = useState<PastExam[]>([]);
  const [examLimit, setExamLimit] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetExam } = useExamStore();
  const orchestrator = useExamOrchestrator();
  const [activeModule, setActiveModule] = useState<ModuleTestType | null>(null);
  const activeExamId = selectedExam?.id || null;

  const [briefingChecklist, setBriefingChecklist] = useState<string[]>([]);
  const [selectedTestHistory, setSelectedTestHistory] = useState<PastExam[]>([]);
  const [selectedTestRadarStats, setSelectedTestRadarStats] = useState<{
    key: string;
    label: string;
    correct: number;
    total: number;
    percentage: number;
  }[]>([]);

  const [selectedModule, setSelectedModule] = useState<ModuleTestType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'Digital' | 'Paper' | null>(null);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedApprovedModule, setSelectedApprovedModule] = useState<ModuleTestType | null>(null);
  const [selectedExamDetails, setSelectedExamDetails] = useState<{
    sectionsCount: number;
    questionsCount: number;
    totalDurationMinutes: number;
    isLoading: boolean;
  } | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    async function loadProfile() {
      try {
        if (!session?.user?.email) {
          timer = setTimeout(() => {
            router.push('/login');
          }, 500);
          return;
        }

        const meRes = await fetch('/api/me');
        if (!meRes.ok) {
          await signOut({ callbackUrl: '/login' });
          return;
        }
        const meData = await meRes.json();
        const realProfile = meData.profile as Profile;

        setProfile(realProfile);
        if (realProfile.module_test && !searchParams.get('module')) {
          setActiveModule(realProfile.module_test as ModuleTestType);
        }

        if (
          realProfile.role !== 'admin'
          && realProfile.status !== 'Approved'
          && realProfile.status !== 'Active'
        ) {
          setExams([]);
          setPastExams([]);
          setIsLoading(false);
          return;
        }

        const examsRes = await fetch('/api/exams');
        if (examsRes.ok) {
          const examsJson = await examsRes.json();
          const loadedExams = (examsJson.exams || []) as Exam[];
          setExams(loadedExams);
          setExamLimit(realProfile.role === 'admin' ? null : realProfile.allow_test_limit ?? 1);
          const matchingExams = loadedExams.filter((e) =>
            !realProfile.format || (e.format || '').toLowerCase() === realProfile.format.toLowerCase()
          );
          if (matchingExams.length > 0) {
            setSelectedExam(matchingExams[0]);
          } else if (loadedExams.length > 0) {
            setSelectedExam(loadedExams[0]);
          }
        }

        const attemptsRes = await fetch('/api/attempts');
        if (attemptsRes.ok) {
          const attemptsJson = await attemptsRes.json();
          setPastExams((attemptsJson.attempts || []) as PastExam[]);
        }

        // Prefetch practice data silently in the background
        usePracticeStore.getState().fetchPracticeData();
      } catch (e) {
        console.error('[DashboardClient] Failed loading profile or exams:', e);
        await signOut({ callbackUrl: '/login' });
      }
      setIsLoading(false);
    }

    loadProfile();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [router, session, searchParams]);

  useEffect(() => {
    if (profile) {
      const urlModule = searchParams.get('module') as ModuleTestType | null;
      setActiveModule(urlModule || profile.module_test || null);
    }
  }, [profile, searchParams]);

  useEffect(() => {
    let active = true;
    const currentExam = selectedExam;
    if (!currentExam) {
      setSelectedExamDetails(null);
      return;
    }

    async function fetchDetails() {
      if (!currentExam) return;
      setSelectedExamDetails({
        sectionsCount: 0,
        questionsCount: 0,
        totalDurationMinutes: 0,
        isLoading: true
      });

      try {
        const res = await fetch(`/api/exams/${currentExam.id}`);
        if (!active) return;
        if (!res.ok) {
          setSelectedExamDetails({
            sectionsCount: 0,
            questionsCount: 0,
            totalDurationMinutes: 0,
            isLoading: false
          });
          return;
        }

        const examData = await res.json();
        const dbSections = examData.sections || [];

        const isPaper = typeof currentExam.format === 'string' && currentExam.format.toLowerCase() === 'paper';
        const { coreSections: coreSectionsMatched, moduleSections: moduleSectionsMatched } = filterSections(dbSections, isPaper, activeModule);
        const allMatchedSections = [...coreSectionsMatched, ...moduleSectionsMatched];
        const sectionsCount = allMatchedSections.length;
        const questionsCount = allMatchedSections.reduce((sum: number, s: any) => sum + (s.question_count || 1), 0);
        const totalDurationSeconds = allMatchedSections.reduce((sum: number, s: any) => sum + (s.duration_seconds || 1800), 0);
        const totalDurationMinutes = Math.round(totalDurationSeconds / 60) + Math.round((isPaper ? BREAK_DURATION_TIME_OF_TEST.paper : BREAK_DURATION_TIME_OF_TEST.digital) / 60);

        setSelectedExamDetails({
          sectionsCount,
          questionsCount,
          totalDurationMinutes,
          isLoading: false
        });
      } catch (err) {
        console.error('Error loading selected exam details:', err);
        if (active) {
          setSelectedExamDetails({
            sectionsCount: 0,
            questionsCount: 0,
            totalDurationMinutes: 0,
            isLoading: false
          });
        }
      }
    }

    fetchDetails();

    return () => {
      active = false;
    };
  }, [selectedExam, activeModule]);

  const handleStartExam = async () => {
    if (!activeExamId || !profile) return;
    setIsStarting(true);
    try {
      const format = profile.format as 'Digital' | 'Paper';
      await orchestrator.startExam(activeExamId, activeModule, format);
      router.push('/exam');
    } catch (err) {
      console.error('Error starting exam:', err);
      setIsStarting(false);
    }
  };

  const handleResumeExam = async (userExamId: string) => {
    setIsStarting(true);
    try {
      const normalizedFormat =
        typeof profile?.format === 'string' && profile.format.toLowerCase() === 'paper'
          ? 'Paper'
          : typeof profile?.format === 'string' && profile.format.toLowerCase() === 'digital'
            ? 'Digital'
            : null;
      await orchestrator.resumeExam(userExamId, activeModule, normalizedFormat);
      router.push('/exam');
    } catch (err) {
      console.error('Error resuming exam:', err);
      setIsStarting(false);
    }
  };

  const handleLogout = async () => {
    resetExam();
    await signOut({ callbackUrl: '/login' });
  };

  const handleSaveConfig = async () => {
    if (!selectedModule || !selectedFormat) {
      setConfigError('Please select both a module and a format.');
      return;
    }
    if (!profile) return;
    setIsSubmittingConfig(true);
    setConfigError(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_test: selectedModule,
          format: selectedFormat
        })
      });
      if (!res.ok) throw new Error('Failed to save configuration');
      const data = await res.json();
      setProfile(data.profile);
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  const handleSaveModuleOnly = async (moduleVal: ModuleTestType) => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_test: moduleVal })
      });
      if (!res.ok) throw new Error('Failed to save module');
      const data = await res.json();
      setProfile(data.profile);
      setActiveModule(moduleVal);
    } catch (e) {
      console.error('Failed to save module:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const hasActiveExam = !!activeExamId;

  const getExamAttemptInfo = (exam: Exam) => {
    const attempts = pastExams.filter((pe) => pe.exam_id === exam.id);
    const attemptCount = attempts.length;
    const limit = isAdmin ? null : (exam.retry_number ?? profile?.allow_test_limit ?? 1);
    const limitReached = limit !== null && attemptCount >= limit;
    
    let bestScore = null;
    let maxScore = null;
    let bestPercentage = 0;
    // Only consider full completions for best score
    attempts.filter((pe) => isFullCompletion(pe)).forEach((pe) => {
      if (pe.total_score !== null && pe.max_score) {
        const pct = Math.round((pe.total_score / pe.max_score) * 100);
        if (pct >= bestPercentage) {
          bestPercentage = pct;
          bestScore = pe.total_score;
          maxScore = pe.max_score;
        }
      }
    });

    return {
      attemptCount,
      limit,
      limitReached,
      bestScore,
      maxScore,
      bestPercentage,
    };
  };

  const computeRadarStats = (formatOverride?: 'Digital' | 'Paper'): RadarStat[] => {
    const totals = new Map<string, Omit<RadarStat, 'percentage'>>();

    for (const attempt of pastExams) {
      if (attempt.status !== 'completed') continue;
      if (!isFullCompletion(attempt)) continue;
      const attemptFormat = attempt.exam_format ?? attempt.exams?.format ?? 'Digital';
      if (formatOverride && attemptFormat !== formatOverride) continue;

      for (const section of attempt.section_scores ?? []) {
        const current = totals.get(section.key) ?? {
          key: section.key,
          label: section.label,
          correct: 0,
          total: 0,
        };
        current.correct += section.correct;
        current.total += section.total;
        totals.set(section.key, current);
      }
    }

    return [...totals.values()].map((section) => ({
      ...section,
      percentage: section.total > 0 ? Math.round((section.correct / section.total) * 100) : 0,
    }));
  };

  const getTestHistory = useCallback((examId: string) => {
    return pastExams.filter((pe) => pe.exam_id === examId);
  }, [pastExams]);

  const computeRadarStatsForExam = useCallback((examId: string, formatOverride?: 'Digital' | 'Paper'): RadarStat[] => {
    const totals = new Map<string, Omit<RadarStat, 'percentage'>>();

    for (const attempt of pastExams) {
      if (attempt.exam_id !== examId || attempt.status !== 'completed') continue;
      if (!isFullCompletion(attempt)) continue;
      const attemptFormat = attempt.exam_format ?? attempt.exams?.format ?? 'Digital';
      if (formatOverride && attemptFormat !== formatOverride) continue;

      for (const section of attempt.section_scores ?? []) {
        const current = totals.get(section.key) ?? {
          key: section.key,
          label: section.label,
          correct: 0,
          total: 0,
        };
        current.correct += section.correct;
        current.total += section.total;
        totals.set(section.key, current);
      }
    }

    return [...totals.values()].map((section) => ({
      ...section,
      percentage: section.total > 0 ? Math.round((section.correct / section.total) * 100) : 0,
    }));
  }, [pastExams]);

  useEffect(() => {
    if (selectedExam) {
      const history = getTestHistory(selectedExam.id);
      setSelectedTestHistory(history);

      const stats = computeRadarStatsForExam(selectedExam.id);
      setSelectedTestRadarStats(stats);
    } else {
      setSelectedTestHistory([]);
      setSelectedTestRadarStats([]);
    }
  }, [selectedExam, getTestHistory, computeRadarStatsForExam]);

  const selectedExamAttemptInfo = selectedExam ? getExamAttemptInfo(selectedExam) : null;
  const isAttemptLimitReached = selectedExamAttemptInfo ? selectedExamAttemptInfo.limitReached : false;
  const isEligible = hasActiveExam && !isAttemptLimitReached;

  return {
    profile,
    isLoading,
    activeModule,
    pastExams,
    exams,
    selectedExam,
    selectedExamDetails,
    setSelectedExam,
    activeExamId,
    examLimit,
    isStarting,
    isAdmin,
    hasActiveExam,
    isEligible,
    isAttemptLimitReached,
    getExamAttemptInfo,
    computeRadarStats,
    handleResumeExam,
    selectedTestHistory,
    selectedTestRadarStats,
    getTestHistory,
    computeRadarStatsForExam,
    selectedModule,
    selectedFormat,
    selectedApprovedModule,
    isSubmittingConfig,
    configError,
    briefingChecklist,
    setBriefingChecklist,
    setSelectedModule,
    setSelectedFormat,
    setSelectedApprovedModule,
    handleStartExam,
    handleLogout,
    handleSaveConfig,
    handleSaveModuleOnly,
  };
}
