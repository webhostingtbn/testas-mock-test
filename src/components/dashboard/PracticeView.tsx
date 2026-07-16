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
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Profile, ModuleTestType } from '@/lib/types';
import PracticeFolderView from './PracticeFolderView';
import PracticeSession from './PracticeSession';

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
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<Record<string, 'easy' | 'medium' | 'hard'>>({});
  const [userPracticeDates, setUserPracticeDates] = useState<Set<string>>(new Set());

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
    sc_1: ['scientific relationships', 'scientific interrelationships', 'quantitative problems'],
    sc_2: ['formal depictions', 'text completion'],
    econ_1: ['economic relationships', 'economic interrelationships'],
    econ_2: ['processes', 'economic processes'],
    eng_1: ['formalising technical', 'formalizing technical'],
    eng_2: ['visualising solids', 'visualizing solids', 'solids'],
    eng_2_2d: ['visualising solids - 2d', 'visualizing solids - 2d', 'solids - 2d', 'visualizing solids 2d'],
    eng_2_3d: ['visualising solids - 3d', 'visualizing solids - 3d', 'solids - 3d', 'visualizing solids 3d'],
    eng_3: ['analysing technical', 'analyzing technical'],
  };

  const getMatchedSections = useCallback((subtest: SubtestType) => {
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

    if (subtest === 'module_mcq') {
      const moduleTitle = getModuleTitle(activeModule);
      return sections.filter(
        (s) =>
          (s.question_type === 'module_mcq' ||
            s.question_type === 'interpreting_texts' ||
            s.question_type === 'representation_systems' ||
            s.question_type === 'linguistic_structures') &&
          s.title === moduleTitle
      );
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
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
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

  const getModuleTitle = (mod: string | null) => {
    if (!mod) return '';
    const m = mod.toLowerCase();
    if (m.includes('econ')) return 'Economics';
    if (m.includes('engin')) return 'Engineering';
    if (m.includes('science') || m === 'cs') return 'Natural Science and Computer Science';
    return '';
  };

  // Main subtest card list
  const subtests = useMemo(() => {
    const paperSubtests: {
      id: SubtestType;
      title: string;
      description: string;
      icon: LucideIcon;
    }[] = [
      {
        id: 'figure_sequence',
        title: 'Completing Patterns',
        description: 'Train visual pattern sequence completion.',
        icon: Blocks
      },
      {
        id: 'solving_quantitative',
        title: 'Solving Quantitative Problems',
        description: 'Practice mathematical word problems.',
        icon: FileText
      },
      {
        id: 'inferring_relationships',
        title: 'Inferring Relationships',
        description: 'Identify the logical relationship between pairs of concepts.',
        icon: BookOpen
      },
      {
        id: 'numerical_series',
        title: 'Continuing Numerical Series',
        description: 'Find pattern rules and continue the numerical series.',
        icon: Clock
      }
    ];

    const digitalSubtests: {
      id: SubtestType;
      title: string;
      description: string;
      icon: LucideIcon;
    }[] = [
      {
        id: 'figure_sequence',
        title: 'Figure Sequences',
        description: 'Train visual pattern recognition and transformations.',
        icon: Blocks
      },
      {
        id: 'math_equation',
        title: 'Mathematical Equations',
        description: 'Practice quantitative relationships and equation logic.',
        icon: FileText
      },
      {
        id: 'latin_square',
        title: 'Latin Squares',
        description: 'Strengthen rule deduction and symbolic reasoning.',
        icon: Layers
      }
    ];

    const baseSubtests = isPaper ? paperSubtests : digitalSubtests;

    if (activeModule) {
      const activeModLower = activeModule.toLowerCase();

      if (isPaper) {
        if (activeModLower.includes('science') || activeModLower === 'cs') {
          baseSubtests.push(
            {
              id: 'sc_1',
              title: 'Analyzing Scientific Relationships',
              description: 'Practice analyzing interrelationships between scientific concepts.',
              icon: Laptop,
            },
            {
              id: 'sc_2',
              title: 'Understanding Formal Depictions',
              description: 'Practice transposing information into diagrams and formal systems.',
              icon: Laptop,
            }
          );
        } else if (activeModLower.includes('engin')) {
          baseSubtests.push(
            {
              id: 'eng_1',
              title: 'Formalizing Technical Interrelationships',
              description: 'Practice formalizing technical and physical laws.',
              icon: Laptop,
            },
            {
              id: 'eng_2_2d',
              title: 'Visualising Solids (2D)',
              description: 'Practice 2D projections and views of 3D objects.',
              icon: Laptop,
            },
            {
              id: 'eng_2_3d',
              title: 'Visualising Solids (3D)',
              description: 'Practice 3D cube rotations and direction analysis.',
              icon: Laptop,
            },
            {
              id: 'eng_3',
              title: 'Analysing Technical Relationships',
              description: 'Practice analyzing physical and technical relationships.',
              icon: Laptop,
            }
          );
        } else if (activeModLower.includes('econ')) {
          baseSubtests.push(
            {
              id: 'econ_1',
              title: 'Analyzing Economic Relationships',
              description: 'Practice analyzing economic data and charts.',
              icon: Laptop,
            },
            {
              id: 'sc_2',
              title: 'Understanding Formal Depictions',
              description: 'Practice transposing information into diagrams and formal systems.',
              icon: Laptop,
            }
          );
        }
      } else {
        const moduleLabel = activeModule.includes('science') || activeModule === 'CS' ? 'Natural & Computer Science' : activeModule;
        baseSubtests.push({
          id: 'module_mcq' as const,
          title: `${moduleLabel} Module`,
          description: `Practice subject-specific questions for ${moduleLabel}.`,
          icon: Laptop,
        });
      }
    }

    return baseSubtests;
  }, [activeModule, isPaper]);

  // Only count rated questions (unrated questions are hidden in practice)
  const getSubtestCounts = (subtest: SubtestType): SubtestCounts => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    let easy = 0;
    let medium = 0;
    let hard = 0;

    subtestQuestions.forEach((q) => {
      const rating = userRatings[q.id];
      if (rating === 'easy') easy++;
      else if (rating === 'medium') medium++;
      else if (rating === 'hard') hard++;
      // unrated questions are not counted
    });

    const total = easy + medium + hard; // Only total rated questions

    return { easy, medium, hard, total };
  };

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
    return result.sort((a, b) => {
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
      const examTitle = s.exams?.title || (Array.isArray(s.exams) ? s.exams[0]?.title : undefined);
      if (examTitle) {
        mapping[s.id] = examTitle;
      }
    });
    return mapping;
  }, [sections]);

  const loadPracticeData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch sections
      const { data: sData } = await supabase
        .from('sections')
        .select('id, title, question_type, exam_id, exams(title)');
      if (sData) setSections(sData);

      // 2. Fetch all questions (only metadata to keep it fast)
      const { data: qData } = await supabase
        .from('questions')
        .select('id, question_type, section_id');
      if (qData) setQuestions(qData);

      // 3. Fetch user ratings with updated_at
      const { data: rData } = await supabase
        .from('user_question_practices')
        .select('question_id, difficulty, updated_at')
        .eq('user_id', profile.id);

      const ratingMap: Record<string, 'easy' | 'medium' | 'hard'> = {};
      const dateSet = new Set<string>();
      if (rData) {
        rData.forEach((row : any) => {
          ratingMap[row.question_id] = row.difficulty as 'easy' | 'medium' | 'hard';
          if (row.updated_at) {
            const dateStr = new Date(row.updated_at).toLocaleDateString('en-CA');
            dateSet.add(dateStr);
          }
        });
      }
      setUserRatings(ratingMap);
      setUserPracticeDates(dateSet);
    } catch (err) {
      console.error('Failed to load practice data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, supabase]);

  useEffect(() => {
    loadPracticeData();
  }, [loadPracticeData]);

  const practiceSubtest = filteredSubtests[0] ?? null;


  // Only show rated questions in practice - hide unrated questions completely
  const getQuestionIdsForFolder = (subtest: SubtestType, folder: string) => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    return subtestQuestions
      .filter((q) => {
        const rating = userRatings[q.id];
        // Only show questions that have been rated (not undefined/null)
        if (!rating) return false;
        return rating === folder;
      })
      .map((q) => q.id);
  };

  const startPracticeSession = async (subtest: SubtestType, folder: 'easy' | 'medium' | 'hard') => {
    setIsLoadingSession(true);
    setSelectedFolder(folder);
    try {
      const targetIds = getQuestionIdsForFolder(subtest, folder);

      // Check if there are no rated questions for this folder
      if (targetIds.length === 0) {
        setPracticeQuestions([]);
        return;
      }

      const isSubjectSubtest = [
        'module_mcq',
        'interpreting_texts',
        'representation_systems',
        'linguistic_structures',
        'sc_1', 'sc_2',
        'econ_1', 'econ_2',
        'eng_1', 'eng_2', 'eng_2_2d', 'eng_2_3d', 'eng_3'
      ].includes(subtest);

      if (isSubjectSubtest) {
        const matchedSections = getMatchedSections(subtest);
        if (matchedSections.length === 0) throw new Error('No section found for this subtest');
        const matchedSectionIds = matchedSections.map((s) => s.id);

        const { data: passagesData } = await supabase
          .from('passages')
          .select('*')
          .in('section_id', matchedSectionIds)
          .order('sort_order', { ascending: true });

        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .in('section_id', matchedSectionIds)
          .order('sort_order', { ascending: true });

        const formattedPassages = (passagesData || []).map((passage: any) => {
          const pQuestions = (questionsData || [])
            .filter((q : any) => q.passage_id === passage.id)
            .map((q: any) => {
              const content = q.content || {};
              let qResolvedUrl;
              if (content.image_url) {
                const { data } = supabase.storage.from('ExamDataset').getPublicUrl(content.image_url);
                qResolvedUrl = data.publicUrl;
              }
              return {
                ...q,
                content: {
                  ...content,
                  resolved_image_url: qResolvedUrl,
                },
                exam_title: sectionIdToExamTitle[q.section_id] || '',
              };
            });

          let resolvedUrl;
          if (passage.image_url) {
            const { data: imgData } = supabase.storage.from('ExamDataset').getPublicUrl(passage.image_url);
            resolvedUrl = imgData.publicUrl;
          }

          return {
            id: passage.id,
            isPassage: true,
            title: passage.title,
            body_markdown: passage.body_markdown,
            image_url: passage.image_url,
            resolved_image_url: resolvedUrl,
            questions: pQuestions,
            sort_order: passage.sort_order,
            exam_title: sectionIdToExamTitle[passage.section_id] || '',
          };
        });

        // Load standalone questions without passages
        const standaloneQuestions = (questionsData || [])
          .filter((q: any) => !q.passage_id)
          .map((q: any) => {
            const content = q.content || {};
            let qResolvedUrl;
            if (content.image_url) {
              const { data } = supabase.storage.from('ExamDataset').getPublicUrl(content.image_url);
              qResolvedUrl = data.publicUrl;
            }
            return {
              ...q,
              isPassage: false,
              content: {
                ...content,
                resolved_image_url: qResolvedUrl,
              },
              exam_title: sectionIdToExamTitle[q.section_id] || '',
            };
          });

        const hasStandalones = standaloneQuestions.length > 0;
        const allCombined = [...formattedPassages, ...standaloneQuestions].sort((a, b) => {
          const aOrder = a.isPassage
            ? (hasStandalones && a.questions.length > 0 ? a.questions[0].sort_order : a.sort_order)
            : a.sort_order;
          const bOrder = b.isPassage
            ? (hasStandalones && b.questions.length > 0 ? b.questions[0].sort_order : b.sort_order)
            : b.sort_order;
          return aOrder - bOrder;
        });

        // Filter only rated questions (questions in targetIds are already rated)
        const combined = allCombined.filter((item: any) => {
          let questionId: string | undefined;
          if (item.isPassage) {
            if (item.questions.length === 0) return false;
            questionId = item.questions[0].id;
          } else {
            questionId = item.id;
          }
          // Only include if question is in our rated targetIds
          return questionId && targetIds.includes(questionId);
        });

        setPracticeQuestions(combined);
      } else {
        const { data: questionsData } = await supabase
          .from('questions')
          .select('id, section_id, sort_order, question_type, content, correct_answer')
          .in('id', targetIds)
          .order('sort_order', { ascending: true });

        const resolved = (questionsData || []).map((q: any) => {
          let updatedQ = {
            ...q,
            exam_title: sectionIdToExamTitle[q.section_id] || '',
          };

          if (subtest === 'figure_sequence') {
            const content = q.content as any;
            const { data: promptData } = supabase.storage
              .from('ExamDataset')
              .getPublicUrl(content.prompt_image || '');

            const resolvedOptions = (content.options || []).map((path: string) => {
              const { data } = supabase.storage.from('ExamDataset').getPublicUrl(path);
              return data.publicUrl;
            });

            updatedQ.content = {
              ...content,
              prompt_image_url: promptData.publicUrl,
              options_urls: resolvedOptions,
            };
          } else if (subtest === 'latin_square' && q.question_type === 'latin_square') {
            const content = q.content as any;
            const { data: imgData } = supabase.storage
              .from('ExamDataset')
              .getPublicUrl(content.grid_image || '');

            updatedQ.content = {
              ...content,
              grid_image_url: imgData.publicUrl,
            };
          }
          return updatedQ;
        });

        setPracticeQuestions(resolved);
      }
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

    const subtestTitles: Record<SubtestType, string> = {
      figure_sequence: isPaper ? 'Completing Patterns' : 'Figure Sequences',
      math_equation: 'Mathematical Equations',
      latin_square: 'Latin Squares',
      solving_quantitative: 'Solving Quantitative Problems',
      inferring_relationships: 'Inferring Relationships',
      numerical_series: 'Continuing Numerical Series',
      interpreting_texts: 'Understanding and Interpreting Texts',
      representation_systems: 'Using Representation Systems Flexibly',
      linguistic_structures: 'Recognizing Linguistic Structures',
      sc_1: 'Analyzing Scientific Relationships',
      sc_2: 'Understanding Formal Depictions',
      econ_1: 'Analyzing Economic Relationships',
      econ_2: 'Analyzing Processes',
      eng_1: 'Formalizing Technical Interrelationships',
      eng_2: 'Visualising Solids',
      eng_2_2d: 'Visualising Solids (2D)',
      eng_2_3d: 'Visualising Solids (3D)',
      eng_3: 'Analysing Technical Relationships',
      module_mcq: activeModule ? (activeModule.includes('science') || activeModule === 'CS' ? 'Natural Science & CS Module' : activeModule) : 'Subject Module',
    };

    return (
      <PracticeSession
        subtestType={selectedSubtest as any}
        subtestTitle={subtestTitles[selectedSubtest]}
        folderId={selectedFolder}
        questions={practiceQuestions}
        userId={profile?.id || ''}
        userEmail={profile?.email || ''}
        userFullName={profile?.full_name}
        supabase={supabase}
        onExit={handleExitPracticeSession}
        onQuestionRated={loadPracticeData}
        isPaper={isPaper}
        isPracticeOnly={true}
      />
    );
  }

  if (selectedSubtest) {
    const subtestTitles: Record<SubtestType, string> = {
      figure_sequence: isPaper ? 'Completing Patterns' : 'Figure Sequences',
      math_equation: 'Mathematical Equations',
      latin_square: 'Latin Squares',
      solving_quantitative: 'Solving Quantitative Problems',
      inferring_relationships: 'Inferring Relationships',
      numerical_series: 'Continuing Numerical Series',
      interpreting_texts: 'Understanding and Interpreting Texts',
      representation_systems: 'Using Representation Systems Flexibly',
      linguistic_structures: 'Recognizing Linguistic Structures',
      sc_1: 'Analyzing Scientific Relationships',
      sc_2: 'Understanding Formal Depictions',
      econ_1: 'Analyzing Economic Relationships',
      econ_2: 'Analyzing Processes',
      eng_1: 'Formalizing Technical Interrelationships',
      eng_2: 'Visualising Solids',
      eng_2_2d: 'Visualising Solids (2D)',
      eng_2_3d: 'Visualising Solids (3D)',
      eng_3: 'Analysing Technical Relationships',
      module_mcq: activeModule ? (activeModule.includes('science') || activeModule === 'CS' ? 'Natural Science & CS Module' : activeModule) : 'Subject Module',
    };

    const counts = getSubtestCounts(selectedSubtest);

    return (
      <PracticeFolderView
        subtestTitle={subtestTitles[selectedSubtest]}
        counts={counts}
        onBack={handleBackToPractice}
        onSelectFolder={(folder) => startPracticeSession(selectedSubtest, folder)}
      />
    );
  }

  if (loading) {
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
