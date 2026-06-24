"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useExamStore } from '@/lib/store/exam-store';
import {
  BREAK_DURATION_TIME_OF_TEST,
  filterSections,
} from '@/lib/constants';
import type { Profile, ModuleTestType, Exam } from '@/lib/types';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useExamOrchestrator } from '@/lib/exam/orchestrator';

interface PastExam {
  exam_id: string;
  total_score: number | null;
  max_score: number | null;
  exams?: { format?: string };
  detailed_results?: unknown;
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
  const supabase = createClient();
  const { resetExam } = useExamStore();
  const orchestrator = useExamOrchestrator();
  // We'll calculate active module based on either URL param or profile
  const [activeModule, setActiveModule] = useState<ModuleTestType | null>(null);
  const activeExamId = selectedExam?.id || null;

  // View state for SPA navigation — managed here so the orchestrator stays slim
  const [briefingChecklist, setBriefingChecklist] = useState<string[]>([]);

  // Per-exam history and stats
  const [selectedTestHistory, setSelectedTestHistory] = useState<PastExam[]>([]);
  const [selectedTestRadarStats, setSelectedTestRadarStats] = useState<{
    key: string;
    label: string;
    correct: number;
    total: number;
    percentage: number;
  }[]>([]);

  // Setup state for new users
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

  // --------------- Effects ---------------

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    async function loadProfile() {
      let fetchedRole = 'user';
      let fetchedLimit = 1;
      let userFormat = 'Digital';

      try {
        if (!session?.user?.email) {
          console.warn('[DashboardClient] No session or user email found', { session, user: session?.user });

          // Only redirect after a small delay to ensure session is fully loaded
          timer = setTimeout(() => {
            console.warn('[DashboardClient] Redirecting to login due to missing session');
            router.push('/login');
          }, 500);
          return;
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
          userFormat = realProfile.format || 'Digital';

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
            .select('*, exams(title, description, major, format)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (examsData) {
            setPastExams(examsData);
          }
        } catch (e) {
          console.warn('Could not load past exams:', e);
        }

        // Fetch all exams for user's format (no longer need is_active = true)
        // Admins see all exams, regular users see exams matching their format
        try {
          const { data: examsData } = await supabase
            .from('exams')
            .select('*, sections(duration_seconds, question_count)')
            .eq('format', userFormat)
            .order('created_at', { ascending: true });

          if (examsData) {
            setExams(examsData as Exam[]);
            setExamLimit(fetchedRole === 'admin' ? null : fetchedLimit);
            if (examsData.length > 0) {
              setSelectedExam(examsData[0] as Exam);
            }
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

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [router, supabase, session, searchParams]);

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
        const { data: dbSections, error } = await supabase
          .from('sections')
          .select('id, title, question_type, duration_seconds, question_count, sort_order')
          .eq('exam_id', currentExam.id)
          .order('sort_order', { ascending: true });

        if (!active) return;

        if (error || !dbSections || dbSections.length === 0) {
          setSelectedExamDetails({
            sectionsCount: 0,
            questionsCount: 0,
            totalDurationMinutes: 0,
            isLoading: false
          });
          return;
        }

        const isPaper = currentExam.format === 'Paper';
        const { coreSections: coreSectionsMatched, moduleSections: moduleSectionsMatched } = filterSections(dbSections, isPaper, activeModule);
        const allMatchedSections = [...coreSectionsMatched, ...moduleSectionsMatched];
        const sectionsCount = allMatchedSections.length;
        const questionsCount = allMatchedSections.reduce((sum, s) => sum + (s.question_count || 0), 0);
        const totalDurationSeconds = allMatchedSections.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
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
  }, [selectedExam, activeModule, supabase]);

  // --------------- Actions ---------------

  const handleStartExam = async () => {
    if (!activeExamId || !profile) {
      return;
    }

    setIsStarting(true);

    try {
      const format = profile.format as 'Digital' | 'Paper';
      await orchestrator.startExam(activeExamId, activeModule, format, profile.id);
      router.push('/exam');
    } catch (err) {
      console.error('Error starting exam:', err);
      setIsStarting(false);
    }
  };

  const handleResumeExam = async (userExamId: string) => {
    setIsStarting(true);

    try {
      await orchestrator.resumeExam(userExamId, activeModule, profile?.id);
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

  const computeRadarStats = (formatOverride?: 'Digital' | 'Paper') => {
    const selectedFormat = formatOverride || profile?.format || 'Digital';
    const isPaper = selectedFormat === 'Paper';
    const activeMod = activeModule || profile?.module_test || '';
    const activeModLower = activeMod.toLowerCase();

    // 1. Define categories based on format and active module
    const categories: Record<string, { correct: number; total: number; label: string; matchKeywords: string[] }> = {};

    if (isPaper) {
      // Core Paper subtests
      categories['solving_quantitative'] = { correct: 0, total: 0, label: 'Solving Quantitative Problems', matchKeywords: ['solving quantitative problems', 'solving quantitative', 'math equations', 'math equation'] };
      categories['inferring_relationships'] = { correct: 0, total: 0, label: 'Inferring Relationships', matchKeywords: ['inferring relationships', 'inferring relation', 'latin squares', 'latin square'] };
      categories['completing_patterns'] = { correct: 0, total: 0, label: 'Completing Patterns', matchKeywords: ['completing patterns', 'completing pattern', 'figure sequences', 'figure sequence'] };
      categories['numerical_series'] = { correct: 0, total: 0, label: 'Continuing Numerical Series', matchKeywords: ['continuing numerical series', 'numerical series'] };

      // Subject Module Paper subtests
      if (activeModLower.includes('science') || activeModLower === 'cs') {
        categories['sc_1'] = { correct: 0, total: 0, label: 'Analysing Scientific Relationships', matchKeywords: ['analysing scientific relationships', 'scientific relationships', 'quantitative problems', 'quantitative problem'] };
        categories['sc_2'] = { correct: 0, total: 0, label: 'Understanding Formal Depictions', matchKeywords: ['understanding formal depictions', 'formal depictions', 'text completion', 'text completions'] };
      } else if (activeModLower.includes('econ')) {
        categories['econ_1'] = { correct: 0, total: 0, label: 'Analyzing Economic Relationships', matchKeywords: ['analyzing economic relationships', 'economic relationships', 'economic relationship'] };
        categories['econ_2'] = { correct: 0, total: 0, label: 'Analyzing Processes', matchKeywords: ['analyzing processes', 'processes', 'process'] };
      } else if (activeModLower.includes('eng')) {
        categories['eng_1'] = { correct: 0, total: 0, label: 'Formalizing Technical Interrelationships', matchKeywords: ['Formalizing Technical Interrelationships', 'technical relationships', 'formalising technical'] };
        categories['eng_2_2d'] = { correct: 0, total: 0, label: 'Visualising Solids (2D)', matchKeywords: ['visualising solids - 2d', 'visualizing solids - 2d', 'solids - 2d', 'visualizing solids 2d'] };
        categories['eng_2_3d'] = { correct: 0, total: 0, label: 'Visualising Solids (3D)', matchKeywords: ['visualising solids - 3d', 'visualizing solids - 3d', 'solids - 3d', 'visualizing solids 3d'] };
        categories['eng_3'] = { correct: 0, total: 0, label: 'Analysing Technical Relationships', matchKeywords: ['analysing technical relationships', 'technical relationships', 'analysing technical'] };
      } else {
        // Fallback generic subject module
        categories['module_mcq'] = { correct: 0, total: 0, label: 'Subject Module', matchKeywords: ['module', 'subject'] };
      }
    } else {
      // Core Digital subtests
      categories['figure_sequence'] = { correct: 0, total: 0, label: 'Figure Sequences', matchKeywords: ['figure sequences', 'figure sequence', 'figural sequence', 'completing patterns', 'completing pattern'] };
      categories['math_equation'] = { correct: 0, total: 0, label: 'Math Equations', matchKeywords: ['math equations', 'math equation', 'mathematical equation', 'solving quantitative problems', 'solving quantitative'] };
      categories['latin_square'] = { correct: 0, total: 0, label: 'Latin Squares', matchKeywords: ['latin squares', 'latin square', 'inferring relationships', 'inferring relation'] };

      // Subject Module Digital subtests
      if (activeModLower.includes('science') || activeModLower === 'cs') {
        categories['quantitative'] = { correct: 0, total: 0, label: 'Quantitative Problems', matchKeywords: ['quantitative problems', 'quantitative problem', 'analysing scientific relationships', 'scientific relationships'] };
        categories['text'] = { correct: 0, total: 0, label: 'Text Completion', matchKeywords: ['text completion', 'text completions', 'understanding formal depictions', 'formal depictions'] };
      } else if (activeModLower.includes('econ')) {
        categories['econ_1'] = { correct: 0, total: 0, label: 'Analyzing Economic Relationships', matchKeywords: ['analyzing economic relationships', 'economic relationships', 'economic relationship'] };
        categories['econ_2'] = { correct: 0, total: 0, label: 'Analyzing Processes', matchKeywords: ['analyzing processes', 'processes', 'process'] };
      } else if (activeModLower.includes('eng')) {
        categories['eng_1'] = { correct: 0, total: 0, label: 'Formalizing Technical Interrelationships', matchKeywords: ['Formalizing Technical Interrelationships', 'technical relationships', 'formalising technical'] };
        categories['eng_2'] = { correct: 0, total: 0, label: 'Analysing Technical Relationships', matchKeywords: ['analysing technical relationships', 'technical relationships', 'analysing technical'] };
      } else {
        // Fallback generic subject module
        categories['module_mcq'] = { correct: 0, total: 0, label: 'Subject Module', matchKeywords: ['module', 'subject'] };
      }
    }

    // Helper to safely extract score from detailed section data
    const getScore = (sectionData: unknown, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        // Legacy array of answers: count the correct ones
        return sectionData.filter((ans: { is_correct?: boolean; correct?: boolean }) => ans && (ans.is_correct === true || ans.correct === true)).length;
      }
      if (typeof sectionData !== 'object') return 0;

      const s = (sectionData as { score?: number | string }).score;
      if (typeof s === 'number') return s;
      if (typeof s === 'string') {
        const p = parseInt(s, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof s === 'object' && s !== null) {
        // Nested detailedAnswersByTitle object due to some legacy bug
        const scoreObj = s as Record<string, { score?: number }>;
        if (scoreObj[sectionTitle] && typeof scoreObj[sectionTitle].score === 'number') {
          return scoreObj[sectionTitle].score;
        }
        const titleLower = sectionTitle.toLowerCase();
        const matchedKey = Object.keys(scoreObj).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
        if (matchedKey && scoreObj[matchedKey] && typeof scoreObj[matchedKey].score === 'number') {
          return scoreObj[matchedKey].score;
        }
      }
      return 0;
    };

    // Helper to safely extract max_score from detailed section data
    const getMaxScore = (sectionData: unknown, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        // Legacy array of answers: length of the array
        return sectionData.length;
      }
      if (typeof sectionData !== 'object') return 0;

      const ms = (sectionData as { max_score?: number | string }).max_score;
      if (typeof ms === 'number') return ms;
      if (typeof ms === 'string') {
        const p = parseInt(ms, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof (sectionData as { score?: unknown }).score === 'object' && (sectionData as { score: unknown }).score !== null) {
        // Nested detailedAnswersByTitle object
        const s = (sectionData as { score: Record<string, { max_score?: number }> }).score;
        if (s[sectionTitle] && typeof s[sectionTitle].max_score === 'number') {
          return s[sectionTitle].max_score;
        }
        const titleLower = sectionTitle.toLowerCase();
        const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
        if (matchedKey && s[matchedKey] && typeof s[matchedKey].max_score === 'number') {
          return s[matchedKey].max_score;
        }
      }
      return 0;
    };

    // 2. Populate stats from past exams
    pastExams.forEach((attempt) => {
      const examFormat = (attempt as { exams?: { format?: string }; detailed_results?: unknown }).exams?.format || 'Digital';
      if (examFormat !== selectedFormat) return;

      const detailed = (attempt as { detailed_results?: unknown }).detailed_results;
      if (!detailed || typeof detailed !== 'object') return;

      Object.entries(detailed as Record<string, unknown>).forEach(([sectionTitle, sectionData]: [string, unknown]) => {
        if (!sectionData) return;

        const titleLower = sectionTitle.toLowerCase();
        
        // Find which category matches this section title
        const matchedEntry = Object.entries(categories).find(([, cat]) => {
          return cat.matchKeywords.some(keyword => titleLower.includes(keyword));
        });

        if (matchedEntry) {
          const key = matchedEntry[0];
          categories[key].correct += getScore(sectionData, sectionTitle);
          categories[key].total += getMaxScore(sectionData, sectionTitle);
        } else {
          // Fallback matching by type
          let type: string | undefined = undefined;
          if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
            type = (sectionData as { type?: string }).type;
          }
          if (type) {
            if (isPaper) {
              if (type === 'figure_sequence') type = 'completing_patterns';
              else if (type === 'math_equation') type = 'solving_quantitative';
              else if (type === 'latin_square') type = 'inferring_relationships';
            } else {
              if (type === 'completing_patterns') type = 'figure_sequence';
              else if (type === 'solving_quantitative') type = 'math_equation';
              else if (type === 'inferring_relationships') type = 'latin_square';
            }
            if (categories[type]) {
              categories[type].correct += getScore(sectionData, sectionTitle);
              categories[type].total += getMaxScore(sectionData, sectionTitle);
            }
          }
        }
      });
    });

    // 3. Return array of stats
    return Object.entries(categories).map(([key, data]) => {
      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      return {
        key,
        label: data.label,
        correct: data.correct,
        total: data.total,
        percentage: pct,
      };
    });
  };

  // Per-exam history tracking
  const getTestHistory = useCallback((examId: string) => {
    return pastExams.filter((pe) => pe.exam_id === examId);
  }, [pastExams]);

  // Per-exam radar stats computation
  const computeRadarStatsForExam = useCallback((examId: string, formatOverride?: 'Digital' | 'Paper') => {
    // Get exam format from the selected exam if not provided
    const examFormat = selectedExam?.format || formatOverride || profile?.format || 'Digital';
    const isPaper = examFormat === 'Paper';
    const activeMod = activeModule || profile?.module_test || '';
    const activeModLower = activeMod.toLowerCase();

    // 1. Define categories based on format and active module
    const categories: Record<string, { correct: number; total: number; label: string; matchKeywords: string[] }> = {};

    if (isPaper) {
      // Core Paper subtests
      categories['solving_quantitative'] = { correct: 0, total: 0, label: 'Solving Quantitative Problems', matchKeywords: ['solving quantitative problems', 'solving quantitative', 'math equations', 'math equation'] };
      categories['inferring_relationships'] = { correct: 0, total: 0, label: 'Inferring Relationships', matchKeywords: ['inferring relationships', 'inferring relation', 'latin squares', 'latin square'] };
      categories['completing_patterns'] = { correct: 0, total: 0, label: 'Completing Patterns', matchKeywords: ['completing patterns', 'completing pattern', 'figure sequences', 'figure sequence'] };
      categories['numerical_series'] = { correct: 0, total: 0, label: 'Continuing Numerical Series', matchKeywords: ['continuing numerical series', 'numerical series'] };

      // Subject Module Paper subtests
      if (activeModLower.includes('science') || activeModLower === 'cs') {
        categories['sc_1'] = { correct: 0, total: 0, label: 'Analysing Scientific Relationships', matchKeywords: ['analysing scientific relationships', 'scientific relationships', 'quantitative problems', 'quantitative problem'] };
        categories['sc_2'] = { correct: 0, total: 0, label: 'Understanding Formal Depictions', matchKeywords: ['understanding formal depictions', 'formal depictions', 'text completion', 'text completions'] };
      } else if (activeModLower.includes('econ')) {
        categories['econ_1'] = { correct: 0, total: 0, label: 'Analyzing Economic Relationships', matchKeywords: ['analyzing economic relationships', 'economic relationships', 'economic relationship'] };
        categories['econ_2'] = { correct: 0, total: 0, label: 'Analyzing Processes', matchKeywords: ['analyzing processes', 'processes', 'process'] };
      } else if (activeModLower.includes('eng')) {
        categories['eng_1'] = { correct: 0, total: 0, label: 'Formalizing Technical Interrelationships', matchKeywords: ['Formalizing Technical Interrelationships', 'technical relationships', 'formalising technical'] };
        categories['eng_2_2d'] = { correct: 0, total: 0, label: 'Visualising Solids (2D)', matchKeywords: ['visualising solids - 2d', 'visualizing solids - 2d', 'solids - 2d', 'visualizing solids 2d'] };
        categories['eng_2_3d'] = { correct: 0, total: 0, label: 'Visualising Solids (3D)', matchKeywords: ['visualising solids - 3d', 'visualizing solids - 3d', 'solids - 3d', 'visualizing solids 3d'] };
        categories['eng_3'] = { correct: 0, total: 0, label: 'Analysing Technical Relationships', matchKeywords: ['analysing technical relationships', 'technical relationships', 'analysing technical'] };
      } else {
        // Fallback generic subject module
        categories['module_mcq'] = { correct: 0, total: 0, label: 'Subject Module', matchKeywords: ['module', 'subject'] };
      }
    } else {
      // Core Digital subtests
      categories['figure_sequence'] = { correct: 0, total: 0, label: 'Figure Sequences', matchKeywords: ['figure sequences', 'figure sequence', 'figural sequence', 'completing patterns', 'completing pattern'] };
      categories['math_equation'] = { correct: 0, total: 0, label: 'Math Equations', matchKeywords: ['math equations', 'math equation', 'mathematical equation', 'solving quantitative problems', 'solving quantitative'] };
      categories['latin_square'] = { correct: 0, total: 0, label: 'Latin Squares', matchKeywords: ['latin squares', 'latin square', 'inferring relationships', 'inferring relation'] };

      // Subject Module Digital subtests
      if (activeModLower.includes('science') || activeModLower === 'cs') {
        categories['quantitative'] = { correct: 0, total: 0, label: 'Quantitative Problems', matchKeywords: ['quantitative problems', 'quantitative problem', 'analysing scientific relationships', 'scientific relationships'] };
        categories['text'] = { correct: 0, total: 0, label: 'Text Completion', matchKeywords: ['text completion', 'text completions', 'understanding formal depictions', 'formal depictions'] };
      } else if (activeModLower.includes('econ')) {
        categories['econ_1'] = { correct: 0, total: 0, label: 'Analyzing Economic Relationships', matchKeywords: ['analyzing economic relationships', 'economic relationships', 'economic relationship'] };
        categories['econ_2'] = { correct: 0, total: 0, label: 'Analyzing Processes', matchKeywords: ['analyzing processes', 'processes', 'process'] };
      } else if (activeModLower.includes('eng')) {
        categories['eng_1'] = { correct: 0, total: 0, label: 'Formalizing Technical Interrelationships', matchKeywords: ['Formalizing Technical Interrelationships', 'technical relationships', 'formalising technical'] };
        categories['eng_2'] = { correct: 0, total: 0, label: 'Analysing Technical Relationships', matchKeywords: ['analysing technical relationships', 'technical relationships', 'analysing technical'] };
      } else {
        // Fallback generic subject module
        categories['module_mcq'] = { correct: 0, total: 0, label: 'Subject Module', matchKeywords: ['module', 'subject'] };
      }
    }

    // Helper to safely extract score from detailed section data
    const getScore = (sectionData: any, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        return sectionData.filter((ans: { is_correct?: boolean; correct?: boolean }) => ans && (ans.is_correct === true || ans.correct === true)).length;
      }
      if (typeof sectionData !== 'object') return 0;

      const s = (sectionData as { score?: number | string }).score;
      if (typeof s === 'number') return s;
      if (typeof s === 'string') {
        const p = parseInt(s, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof s === 'object' && s !== null) {
        const scoreObj = s as Record<string, { score?: number }>;
        if (scoreObj[sectionTitle] && typeof scoreObj[sectionTitle].score === 'number') {
          return scoreObj[sectionTitle].score;
        }
        const titleLower = sectionTitle.toLowerCase();
        const matchedKey = Object.keys(scoreObj).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
        if (matchedKey && scoreObj[matchedKey] && typeof scoreObj[matchedKey].score === 'number') {
          return scoreObj[matchedKey].score;
        }
      }
      return 0;
    };

    const getMaxScore = (sectionData: any, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        return sectionData.length;
      }
      if (typeof sectionData !== 'object') return 0;

      const ms = (sectionData as { max_score?: number | string }).max_score;
      if (typeof ms === 'number') return ms;
      if (typeof ms === 'string') {
        const p = parseInt(ms, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof (sectionData as { score?: any }).score === 'object' && (sectionData as { score: any }).score !== null) {
        const s = (sectionData as { score: Record<string, { max_score?: number }> }).score;
        if (s[sectionTitle] && typeof s[sectionTitle].max_score === 'number') {
          return s[sectionTitle].max_score;
        }
        const titleLower = sectionTitle.toLowerCase();
        const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
        if (matchedKey && s[matchedKey] && typeof s[matchedKey].max_score === 'number') {
          return s[matchedKey].max_score;
        }
      }
      return 0;
    };

    // 2. Populate stats from past exams for this specific test
    pastExams.forEach((attempt) => {
      if (attempt.exam_id !== examId) return;

      const attemptFormat = (attempt as { exams?: { format?: string }; detailed_results?: any }).exams?.format || 'Digital';
      if (attemptFormat !== examFormat) return;

      const detailed = (attempt as { detailed_results?: any }).detailed_results;
      if (!detailed || typeof detailed !== 'object') return;

      Object.entries(detailed as Record<string, any>).forEach(([sectionTitle, sectionData]: [string, any]) => {
        if (!sectionData) return;

        const titleLower = sectionTitle.toLowerCase();

        // Find which category matches this section title
        const matchedEntry = Object.entries(categories).find(([, cat]) => {
          return cat.matchKeywords.some(keyword => titleLower.includes(keyword));
        });

        if (matchedEntry) {
          const key = matchedEntry[0];
          categories[key].correct += getScore(sectionData, sectionTitle);
          categories[key].total += getMaxScore(sectionData, sectionTitle);
        } else {
          // Fallback matching by type
          let type: string | undefined = undefined;
          if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
            type = (sectionData as { type?: string }).type;
          }
          if (type) {
            if (isPaper) {
              if (type === 'figure_sequence') type = 'completing_patterns';
              else if (type === 'math_equation') type = 'solving_quantitative';
              else if (type === 'latin_square') type = 'inferring_relationships';
            } else {
              if (type === 'completing_patterns') type = 'figure_sequence';
              else if (type === 'solving_quantitative') type = 'math_equation';
              else if (type === 'inferring_relationships') type = 'latin_square';
            }
            if (categories[type]) {
              categories[type].correct += getScore(sectionData, sectionTitle);
              categories[type].total += getMaxScore(sectionData, sectionTitle);
            }
          }
        }
      });
    });

    // 3. Return array of stats
    return Object.entries(categories).map(([key, data]) => {
      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      return {
        key,
        label: data.label,
        correct: data.correct,
        total: data.total,
        percentage: pct,
      };
    });
  }, [selectedExam, profile, activeModule, pastExams]);

  // Update selected test history when exam changes
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
    // Data
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

    // Per-exam history and stats
    selectedTestHistory,
    selectedTestRadarStats,
    getTestHistory,
    computeRadarStatsForExam,

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
