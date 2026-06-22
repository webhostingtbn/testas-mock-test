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

        // Fetch all active exams
        try {
          const { data: examsData } = await supabase
            .from('exams')
            .select('*')
            .eq('is_active', true)
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

      // Fetch the exam format first
      const { data: examData, error: examFetchError } = await supabase
        .from('exams')
        .select('format')
        .eq('id', EXAM_ID)
        .single();
      
      if (examFetchError || !examData) {
        throw new Error('Failed to fetch exam format from database');
      }
      
      const isPaper = examData.format === 'Paper';

      // 1. Separate Core sections
      const coreSectionsMatched = dbSections.filter((s: any) => {
        if (isPaper) {
          return [
            'solving_quantitative',
            'inferring_relationships',
            'completing_patterns',
            'numerical_series'
          ].includes(s.question_type);
        } else {
          return [
            'figure_sequence',
            'math_equation',
            'latin_square'
          ].includes(s.question_type);
        }
      });

      // 2. Separate Module sections matching user's selected module
      const moduleSectionsMatched = dbSections.filter((s: any) => {
        if (!activeModule) return false;
        const normalizedModule = activeModule.toLowerCase();

        if (isPaper) {
          if (normalizedModule.includes('science') || normalizedModule === 'cs') {
            return s.question_type === 'sc_1' || s.question_type === 'sc_2';
          }
          if (normalizedModule.includes('engin')) {
            return ['eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3'].includes(s.question_type);
          }
          if (normalizedModule.includes('econ')) {
            return s.question_type === 'econ_1' || s.question_type === 'econ_2';
          }
          return false;
        } else {
          // Digital format matching
          if (EXAM_ID === '118ec3ca-b52e-4069-b5dd-eaca31339932') {
            const targetModuleTitle = MODULE_TEST_LABELS[activeModule];
            return (
              ['module_mcq', 'interpreting_texts', 'representation_systems', 'linguistic_structures'].includes(s.question_type) &&
              s.title === targetModuleTitle
            );
          } else {
            const type = s.question_type;
            if (normalizedModule.includes('science') || normalizedModule === 'cs') {
              return type === 'representation_systems';
            }
            if (normalizedModule.includes('engin')) {
              return type === 'representation_systems';
            }
            if (normalizedModule.includes('econ')) {
              return type === 'interpreting_texts';
            }
            if (normalizedModule.includes('humanities')) {
              return type === 'interpreting_texts' || type === 'linguistic_structures';
            }
            return false;
          }
        }
      });

      const passageSectionTypes = ['module_mcq', 'interpreting_texts', 'representation_systems', 'linguistic_structures'];
      
      const questionSections = [
        ...coreSectionsMatched,
        ...moduleSectionsMatched.filter((s: any) => !passageSectionTypes.includes(s.question_type))
      ];

      const questionSectionIds = questionSections.map((s: any) => s.id);
      let dbQuestions: any[] = [];
      if (questionSectionIds.length > 0) {
        const { data, error: questionsError } = await supabase
          .from('questions')
          .select('id, section_id, sort_order')
          .in('section_id', questionSectionIds)
          .order('sort_order', { ascending: true });

        if (questionsError) throw new Error('Failed to load questions from database');
        dbQuestions = data || [];
      }

      // Group question IDs by section_id
      const questionIdsBySectionId: Record<string, string[]> = {};
      for (const q of dbQuestions) {
        if (!questionIdsBySectionId[q.section_id]) {
          questionIdsBySectionId[q.section_id] = [];
        }
        questionIdsBySectionId[q.section_id].push(q.id);
      }

      // Build Core sections
      const coreSections = coreSectionsMatched.map((s: any) => ({
        id: s.id,
        title: s.title,
        questionType: s.question_type,
        durationSeconds: s.duration_seconds,
        questionCount: s.question_count,
        questionIds: questionIdsBySectionId[s.id] || [],
      }));

      // Build Module sections
      const moduleSectionObjs = [];
      for (const mSec of moduleSectionsMatched) {
        if (passageSectionTypes.includes(mSec.question_type)) {
          // Uses passages (Digital module)
          const { data: dbPassages, error: passagesError } = await supabase
            .from('passages')
            .select('id')
            .eq('section_id', mSec.id)
            .order('sort_order', { ascending: true });

          if (!passagesError && dbPassages) {
            moduleSectionObjs.push({
              id: mSec.id,
              title: `Module: ${mSec.title}`,
              questionType: mSec.question_type,
              durationSeconds: mSec.duration_seconds,
              questionCount: mSec.question_count,
              questionIds: dbPassages.map((p: any) => p.id),
            });
          }
        } else {
          // Uses standard questions (Paper module)
          moduleSectionObjs.push({
            id: mSec.id,
            title: `Module: ${mSec.title}`,
            questionType: mSec.question_type,
            durationSeconds: mSec.duration_seconds,
            questionCount: mSec.question_count,
            questionIds: questionIdsBySectionId[mSec.id] || [],
          });
        }
      }

      const allSections = [...coreSections, ...moduleSectionObjs];

      const isModuleSection = (qType: string) => {
        if (isPaper) {
          return [
            'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3',
            'econ_1', 'econ_2',
            'sc_1', 'sc_2'
          ].includes(qType);
        } else {
          return passageSectionTypes.includes(qType);
        }
      };

      const flowSteps = [];
      for (let i = 0; i < allSections.length; i++) {
        flowSteps.push({ type: 'section' as const, sectionIndex: i });
        if (i < allSections.length - 1) {
          const currentIsModule = isModuleSection(allSections[i].questionType);
          const nextIsModule = isModuleSection(allSections[i + 1].questionType);

          const breakDuration = (!currentIsModule && nextIsModule)
            ? BREAK_DURATIONS.LONG
            : BREAK_DURATIONS.SHORT;

          flowSteps.push({ type: 'break' as const, breakDuration });
        }
      }

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

  const handleResumeExam = async (userExamId: string, examId: string) => {
    setIsStarting(true);

    try {
      // Fetch real sections from Supabase, ordered by sort_order
      const { data: dbSections, error: sectionsError } = await supabase
        .from('sections')
        .select('id, title, question_type, duration_seconds, question_count, sort_order')
        .eq('exam_id', examId)
        .order('sort_order', { ascending: true });

      if (sectionsError || !dbSections || dbSections.length === 0) {
        throw new Error('Failed to load sections from database');
      }

      // Fetch the exam format first
      const { data: examData, error: examFetchError } = await supabase
        .from('exams')
        .select('format')
        .eq('id', examId)
        .single();
      
      if (examFetchError || !examData) {
        throw new Error('Failed to fetch exam format from database');
      }
      
      const isPaper = examData.format === 'Paper';

      // 1. Separate Core sections
      const coreSectionsMatched = dbSections.filter((s: any) => {
        if (isPaper) {
          return [
            'solving_quantitative',
            'inferring_relationships',
            'completing_patterns',
            'numerical_series'
          ].includes(s.question_type);
        } else {
          return [
            'figure_sequence',
            'math_equation',
            'latin_square'
          ].includes(s.question_type);
        }
      });

      // 2. Separate Module sections matching user's selected module
      const moduleSectionsMatched = dbSections.filter((s: any) => {
        if (!activeModule) return false;
        const normalizedModule = activeModule.toLowerCase();

        if (isPaper) {
          if (normalizedModule.includes('science') || normalizedModule === 'cs') {
            return s.question_type === 'sc_1' || s.question_type === 'sc_2';
          }
          if (normalizedModule.includes('engin')) {
            return ['eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3'].includes(s.question_type);
          }
          if (normalizedModule.includes('econ')) {
            return s.question_type === 'econ_1' || s.question_type === 'econ_2';
          }
          return false;
        } else {
          // Digital format matching
          if (examId === '118ec3ca-b52e-4069-b5dd-eaca31339932') {
            const targetModuleTitle = MODULE_TEST_LABELS[activeModule];
            return (
              ['module_mcq', 'interpreting_texts', 'representation_systems', 'linguistic_structures'].includes(s.question_type) &&
              s.title === targetModuleTitle
            );
          } else {
            const type = s.question_type;
            if (normalizedModule.includes('science') || normalizedModule === 'cs') {
              return type === 'representation_systems';
            }
            if (normalizedModule.includes('engin')) {
              return type === 'representation_systems';
            }
            if (normalizedModule.includes('econ')) {
              return type === 'interpreting_texts';
            }
            if (normalizedModule.includes('humanities')) {
              return type === 'interpreting_texts' || type === 'linguistic_structures';
            }
            return false;
          }
        }
      });

      const passageSectionTypes = ['module_mcq', 'interpreting_texts', 'representation_systems', 'linguistic_structures'];
      
      const questionSections = [
        ...coreSectionsMatched,
        ...moduleSectionsMatched.filter((s: any) => !passageSectionTypes.includes(s.question_type))
      ];

      const questionSectionIds = questionSections.map((s: any) => s.id);
      let dbQuestions: any[] = [];
      if (questionSectionIds.length > 0) {
        const { data, error: questionsError } = await supabase
          .from('questions')
          .select('id, section_id, sort_order')
          .in('section_id', questionSectionIds)
          .order('sort_order', { ascending: true });

        if (questionsError) throw new Error('Failed to load questions from database');
        dbQuestions = data || [];
      }

      // Group question IDs by section_id
      const questionIdsBySectionId: Record<string, string[]> = {};
      for (const q of dbQuestions) {
        if (!questionIdsBySectionId[q.section_id]) {
          questionIdsBySectionId[q.section_id] = [];
        }
        questionIdsBySectionId[q.section_id].push(q.id);
      }

      // Build Core sections
      const coreSections = coreSectionsMatched.map((s: any) => ({
        id: s.id,
        title: s.title,
        questionType: s.question_type,
        durationSeconds: s.duration_seconds,
        questionCount: s.question_count,
        questionIds: questionIdsBySectionId[s.id] || [],
      }));

      // Build Module sections
      const moduleSectionObjs = [];
      for (const mSec of moduleSectionsMatched) {
        if (passageSectionTypes.includes(mSec.question_type)) {
          // Uses passages (Digital module)
          const { data: dbPassages, error: passagesError } = await supabase
            .from('passages')
            .select('id')
            .eq('section_id', mSec.id)
            .order('sort_order', { ascending: true });

          if (!passagesError && dbPassages) {
            moduleSectionObjs.push({
              id: mSec.id,
              title: `Module: ${mSec.title}`,
              questionType: mSec.question_type,
              durationSeconds: mSec.duration_seconds,
              questionCount: mSec.question_count,
              questionIds: dbPassages.map((p: any) => p.id),
            });
          }
        } else {
          // Uses standard questions (Paper module)
          moduleSectionObjs.push({
            id: mSec.id,
            title: `Module: ${mSec.title}`,
            questionType: mSec.question_type,
            durationSeconds: mSec.duration_seconds,
            questionCount: mSec.question_count,
            questionIds: questionIdsBySectionId[mSec.id] || [],
          });
        }
      }

      const allSections = [...coreSections, ...moduleSectionObjs];

      const isModuleSection = (qType: string) => {
        if (isPaper) {
          return [
            'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3',
            'econ_1', 'econ_2',
            'sc_1', 'sc_2'
          ].includes(qType);
        } else {
          return passageSectionTypes.includes(qType);
        }
      };

      const flowSteps = [];
      for (let i = 0; i < allSections.length; i++) {
        flowSteps.push({ type: 'section' as const, sectionIndex: i });
        if (i < allSections.length - 1) {
          const currentIsModule = isModuleSection(allSections[i].questionType);
          const nextIsModule = isModuleSection(allSections[i + 1].questionType);

          const breakDuration = (!currentIsModule && nextIsModule)
            ? BREAK_DURATIONS.LONG
            : BREAK_DURATIONS.SHORT;

          flowSteps.push({ type: 'break' as const, breakDuration });
        }
      }

      startExam({
        examId,
        userExamId,
        sections: allSections,
        flowSteps,
      });

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
    const getScore = (sectionData: any, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        // Legacy array of answers: count the correct ones
        return sectionData.filter((ans: any) => ans && (ans.is_correct === true || ans.correct === true)).length;
      }
      if (typeof sectionData !== 'object') return 0;
      
      const s = sectionData.score;
      if (typeof s === 'number') return s;
      if (typeof s === 'string') {
        const p = parseInt(s, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof s === 'object' && s !== null) {
        // Nested detailedAnswersByTitle object due to some legacy bug
        if (s[sectionTitle] && typeof s[sectionTitle].score === 'number') {
          return s[sectionTitle].score;
        }
        const titleLower = sectionTitle.toLowerCase();
        const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
        if (matchedKey && s[matchedKey] && typeof s[matchedKey].score === 'number') {
          return s[matchedKey].score;
        }
      }
      return 0;
    };

    // Helper to safely extract max_score from detailed section data
    const getMaxScore = (sectionData: any, sectionTitle: string): number => {
      if (!sectionData) return 0;
      if (Array.isArray(sectionData)) {
        // Legacy array of answers: length of the array
        return sectionData.length;
      }
      if (typeof sectionData !== 'object') return 0;
      
      const ms = sectionData.max_score;
      if (typeof ms === 'number') return ms;
      if (typeof ms === 'string') {
        const p = parseInt(ms, 10);
        return isNaN(p) ? 0 : p;
      }
      if (typeof sectionData.score === 'object' && sectionData.score !== null) {
        // Nested detailedAnswersByTitle object
        const s = sectionData.score;
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
      const examFormat = attempt.exams?.format || 'Digital';
      if (examFormat !== selectedFormat) return;

      const detailed = attempt.detailed_results;
      if (!detailed || typeof detailed !== 'object') return;

      Object.entries(detailed).forEach(([sectionTitle, sectionData]: [string, any]) => {
        if (!sectionData) return;

        const titleLower = sectionTitle.toLowerCase();
        
        // Find which category matches this section title
        const matchedEntry = Object.entries(categories).find(([key, cat]) => {
          return cat.matchKeywords.some(keyword => titleLower.includes(keyword));
        });

        if (matchedEntry) {
          const key = matchedEntry[0];
          categories[key].correct += getScore(sectionData, sectionTitle);
          categories[key].total += getMaxScore(sectionData, sectionTitle);
        } else {
          // Fallback matching by type
          let type = typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData) ? sectionData.type : undefined;
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
    handleResumeExam,

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
