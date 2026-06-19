"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useExamStore } from '@/lib/store/exam-store';
import { BREAK_DURATIONS, MODULE_TEST_LABELS } from '@/lib/constants';
import type { Profile, ModuleTestType, Exam } from '@/lib/types';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';

export function useDashboardData(session: Session) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [pastExams, setPastExams] = useState<any[]>([]);
  const [isStructureOpen, setIsStructureOpen] = useState(true);
  const [examLimit, setExamLimit] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { startExam, resetExam } = useExamStore();
  // We'll calculate active module based on either URL param or profile
  const [activeModule, setActiveModule] = useState<ModuleTestType | null>(null);

  // View state for SPA navigation — managed here so the orchestrator stays slim
  const [briefingChecklist, setBriefingChecklist] = useState<string[]>([]);

  // Setup state for new users
  const [selectedModule, setSelectedModule] = useState<ModuleTestType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'Digital' | 'Paper' | null>(null);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedApprovedModule, setSelectedApprovedModule] = useState<ModuleTestType | null>(null);

  // --------------- Effects ---------------

  useEffect(() => {
    async function loadProfile() {
      let fetchedRole = 'user';
      let fetchedLimit = 1;

      try {
        if (!session?.user?.email) {
          console.warn('[DashboardClient] No session or user email found', { session, user: session?.user });

          // Only redirect after a small delay to ensure session is fully loaded
          const timer = setTimeout(() => {
            console.warn('[DashboardClient] Redirecting to login due to missing session');
            router.push('/login');
          }, 500);
          return () => clearTimeout(timer);
        }

        try {
          const { data: realProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();

          if (profileError || !realProfile) {
            console.warn('[DashboardClient] Profile not found or error loading, signing out...', profileError);
            await signOut({ callbackUrl: '/login' });
            return;
          }

          fetchedRole = realProfile.role || 'user';
          fetchedLimit = realProfile.allow_test_limit ?? 1;

          setProfile(realProfile as Profile);

          if (realProfile.module_test && !searchParams.get('module')) {
             setActiveModule(realProfile.module_test as ModuleTestType);
          }
        } catch (e) {
          console.error('[DashboardClient] Failed to load real profile data, signing out:', e);
          await signOut({ callbackUrl: '/login' });
        }

        // Fetch past exams (might fail due to RLS, allow it to silently fail)
        try {
          const { data: examsData } = await supabase
            .from('user_exams')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (examsData) {
            setPastExams(examsData);
          }
        } catch (e) {
          console.warn('Could not load past exams:', e);
        }

        // Fetch all active exams
        try {
          const { data: examsData } = await supabase
            .from('exams')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

          if (examsData) {
            setExams(examsData as Exam[]);
            setExamLimit(fetchedRole === 'admin' ? null : fetchedLimit);
          } else {
            setExams([]);
            setExamLimit(null);
          }
        } catch (e) {
          console.warn('Could not load exam settings:', e);
          setExams([]);
          setExamLimit(null);
        }

      } catch {
        // Auth failed — use mock profile for dev
        setProfile({
          id: 'dev-user',
          email: 'dev@example.com',
          full_name: 'Dev Student',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'Approved',
          format: 'Digital',
          module_test: 'CS'
        } as Profile);
      }
      setIsLoading(false);
    }

    loadProfile();
  }, [router, supabase, session]);

  useEffect(() => {
    if (profile) {
      const urlModule = searchParams.get('module') as ModuleTestType | null;
      setActiveModule(urlModule || profile.module_test || null);
    }
  }, [profile, searchParams]);

  // --------------- Actions ---------------

  const handleStartExam = async () => {
    if (!activeExamId) {
      return;
    }

    setIsStarting(true);

    try {
      const EXAM_ID = activeExamId;

      // Fetch real sections from Supabase, ordered by sort_order
      const { data: dbSections, error: sectionsError } = await supabase
        .from('sections')
        .select('id, title, question_type, duration_seconds, question_count, sort_order')
        .eq('exam_id', EXAM_ID)
        .order('sort_order', { ascending: true });

      if (sectionsError || !dbSections || dbSections.length === 0) {
        throw new Error('Failed to load sections from database');
      }

      // Fetch question IDs for all core-test sections in one query
      const coreSection = dbSections.filter(s => s.question_type !== 'module_mcq');
      const coreSectionIds = coreSection.map(s => s.id);

      const { data: dbQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, section_id, sort_order')
        .in('section_id', coreSectionIds)
        .order('sort_order', { ascending: true });

      if (questionsError) throw new Error('Failed to load questions');

      // Group question IDs by section_id
      const questionIdsBySectionId: Record<string, string[]> = {};
      for (const q of (dbQuestions || [])) {
        if (!questionIdsBySectionId[q.section_id]) {
          questionIdsBySectionId[q.section_id] = [];
        }
        questionIdsBySectionId[q.section_id].push(q.id);
      }

      // Build real sections array for the exam store
      const coreSections = coreSection.map(s => ({
        id: s.id,
        title: s.title,
        questionType: s.question_type,
        durationSeconds: s.duration_seconds,
        questionCount: s.question_count,
        questionIds: questionIdsBySectionId[s.id] || [],
      }));

      // Fetch passages for the module_mcq section that matches the user's selected module
      const targetModuleTitle = MODULE_TEST_LABELS[activeModule || ''];
      const moduleSection = dbSections.find(
        (s) => s.question_type === 'module_mcq' && s.title === targetModuleTitle
      );
      let moduleSectionObj = null;

      if (moduleSection) {
        const { data: dbPassages, error: passagesError } = await supabase
          .from('passages')
          .select('id')
          .eq('section_id', moduleSection.id)
          .order('sort_order', { ascending: true });

        if (!passagesError && dbPassages) {
          moduleSectionObj = {
            id: moduleSection.id,
            title: `Module: ${MODULE_TEST_LABELS[activeModule || ''] || moduleSection.title}`,
            questionType: moduleSection.question_type,
            durationSeconds: moduleSection.duration_seconds,
            questionCount: moduleSection.question_count, // Number of passages displayed on top
            questionIds: dbPassages.map(p => p.id), // Array of passage_ids
          };
        }
      }

      const allSections = moduleSectionObj
        ? [...coreSections, moduleSectionObj]
        : coreSections;

      const flowSteps = [
        { type: 'section' as const, sectionIndex: 0 },
        { type: 'break' as const, breakDuration: BREAK_DURATIONS.SHORT },
        { type: 'section' as const, sectionIndex: 1 },
        { type: 'break' as const, breakDuration: BREAK_DURATIONS.SHORT },
        { type: 'section' as const, sectionIndex: 2 },
        { type: 'break' as const, breakDuration: BREAK_DURATIONS.LONG },
        { type: 'section' as const, sectionIndex: 3 },
      ];

      // Initialize a real exam session in user_exams
      const { data: userExam, error: userExamError } = await supabase
        .from('user_exams')
        .insert({
          user_id: profile?.id,
          exam_id: EXAM_ID,
          status: 'in_progress',
        })
        .select()
        .single();

      if (userExamError || !userExam) {
        throw new Error('Failed to create the exam session in database');
      }

      startExam({
        examId: EXAM_ID,
        userExamId: userExam.id,
        sections: allSections,
        flowSteps,
      });

      router.push('/exam');
    } catch (err) {
      console.error('Error starting exam:', err);
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
      const { error: patchError } = await supabase
        .from('profiles')
        .update({
          module_test: selectedModule,
          format: selectedFormat
        })
        .eq('id', profile.id);

      console.log('Configuration saved successfully.');

      if (patchError) throw patchError;

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        module_test: selectedModule,
        format: selectedFormat
      } : null);
    } catch (err: any) {
      setConfigError(err.message || 'Failed to save configuration.');
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  const handleSaveModuleOnly = async (moduleVal: ModuleTestType) => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const { error: patchError } = await supabase
        .from('profiles')
        .update({
          module_test: moduleVal
        })
        .eq('id', profile.id);

      if (patchError) throw patchError;

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        module_test: moduleVal
      } : null);
      setActiveModule(moduleVal);
    } catch (e) {
      console.error('Failed to save module:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------- Derived state ---------------

  const isAdmin = profile?.role === 'admin';
  const activeExamId = selectedExam?.id || null;
  const hasActiveExam = !!activeExamId;

  const getExamAttemptInfo = (exam: Exam) => {
    const attempts = pastExams.filter((pe) => pe.exam_id === exam.id);
    const attemptCount = attempts.length;
    
    // Attempt limit is the exam's retry_number (if defined and not null), otherwise the profile's allow_test_limit.
    // If admin, there is no limit.
    const limit = isAdmin ? null : (exam.retry_number ?? profile?.allow_test_limit ?? 1);
    const limitReached = limit !== null && attemptCount >= limit;
    
    // Find the best score achieved
    let bestScore = null;
    let maxScore = null;
    let bestPercentage = 0;
    attempts.forEach((pe) => {
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

  const computeRadarStats = () => {
    const categories: Record<string, { correct: number; total: number }> = {
      figure_sequence: { correct: 0, total: 0 },
      math_equation: { correct: 0, total: 0 },
      latin_square: { correct: 0, total: 0 },
      module_mcq: { correct: 0, total: 0 },
    };

    pastExams.forEach((attempt) => {
      const detailed = attempt.detailed_results;
      if (!detailed || typeof detailed !== 'object') return;

      Object.entries(detailed).forEach(([sectionTitle, sectionData]: [string, any]) => {
        if (!sectionData || typeof sectionData !== 'object') return;

        let type = sectionData.type;
        if (!type) {
          const titleLower = sectionTitle.toLowerCase();
          if (titleLower.includes('figure')) {
            type = 'figure_sequence';
          } else if (titleLower.includes('equation') || titleLower.includes('math')) {
            type = 'math_equation';
          } else if (titleLower.includes('latin') || titleLower.includes('square')) {
            type = 'latin_square';
          } else if (titleLower.includes('module') || titleLower.includes('computer') || titleLower.includes('economics') || titleLower.includes('engineering')) {
            type = 'module_mcq';
          }
        }

        if (type && categories[type]) {
          categories[type].correct += sectionData.score || 0;
          categories[type].total += sectionData.max_score || 0;
        }
      });
    });

    return Object.entries(categories).map(([key, data]) => {
      const label =
        key === 'figure_sequence'
          ? 'Figure Sequences'
          : key === 'math_equation'
          ? 'Math Equations'
          : key === 'latin_square'
          ? 'Latin Squares'
          : 'Subject Module';

      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;

      return {
        key,
        label,
        correct: data.correct,
        total: data.total,
        percentage: pct,
      };
    });
  };

  const selectedExamAttemptInfo = selectedExam ? getExamAttemptInfo(selectedExam) : null;
  const isAttemptLimitReached = selectedExamAttemptInfo ? selectedExamAttemptInfo.limitReached : false;
  const isEligible = hasActiveExam && !isAttemptLimitReached;

  return {
    // Data
    profile,
    isLoading,
    activeModule,
    pastExams,
    exams,
    selectedExam,
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

    // Gate-screen config state
    selectedModule,
    selectedFormat,
    selectedApprovedModule,
    isSubmittingConfig,
    configError,

    // Briefing state
    briefingChecklist,
    setBriefingChecklist,

    // Setters
    setSelectedModule,
    setSelectedFormat,
    setSelectedApprovedModule,

    // Actions
    handleStartExam,
    handleLogout,
    handleSaveConfig,
    handleSaveModuleOnly,
  };
}
