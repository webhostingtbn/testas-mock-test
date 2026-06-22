'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, FileText, Layers, Laptop, ChevronRight, BookOpen, Clock, Target, BarChart3, Flame, Check } from 'lucide-react';
import { KniCard } from '@/components/KniPrimitives';
import { createClient } from '@/lib/supabase/client';
import type { Profile, ModuleTestType } from '@/lib/types';
import PracticeFolderView from './PracticeFolderView';
import PracticeSession from './PracticeSession';

interface PracticeViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
}

export function PracticeView({ profile, activeModule }: PracticeViewProps) {
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
  const [selectedFolder, setSelectedFolder] = useState<'easy' | 'medium' | 'hard' | 'unclassified' | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const getModuleTitle = (mod: string | null) => {
    if (!mod) return '';
    const m = mod.toLowerCase();
    if (m.includes('econ')) return 'Economics';
    if (m.includes('engin')) return 'Engineering';
    if (m.includes('science') || m === 'cs') return 'Natural Science and Computer Science';
    return '';
  };

  const loadPracticeData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch sections
      const { data: sData } = await supabase
        .from('sections')
        .select('id, title, question_type');
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
        rData.forEach((row) => {
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

  const getSubtestCounts = (subtest: SubtestType) => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    let easy = 0;
    let medium = 0;
    let hard = 0;
    let unclassified = 0;

    subtestQuestions.forEach((q) => {
      const rating = userRatings[q.id];
      if (rating === 'easy') easy++;
      else if (rating === 'medium') medium++;
      else if (rating === 'hard') hard++;
      else unclassified++;
    });

    const total = subtestQuestions.length;

    return { easy, medium, hard, unclassified, total };
  };

  const getQuestionIdsForFolder = (subtest: SubtestType, folder: string) => {
    const matchedSections = getMatchedSections(subtest);
    const matchedSectionIds = new Set(matchedSections.map(s => s.id));
    const subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));

    return subtestQuestions
      .filter((q) => {
        const rating = userRatings[q.id];
        if (folder === 'unclassified') return !rating;
        return rating === folder;
      })
      .map((q) => q.id);
  };

  const startPracticeSession = async (subtest: SubtestType, folder: 'easy' | 'medium' | 'hard' | 'unclassified') => {
    setIsLoadingSession(true);
    setSelectedFolder(folder);
    try {
      const targetIds = getQuestionIdsForFolder(subtest, folder);

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
            .filter((q) => q.passage_id === passage.id)
            .map((q) => {
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
          };
        });

        // Load standalone questions without passages
        const standaloneQuestions = (questionsData || [])
          .filter((q) => !q.passage_id)
          .map((q) => {
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

        const allCombinedWithNumbers = allCombined.map((item, index) => ({
          ...item,
          display_number: index + 1,
          total_subtest_questions: allCombined.length,
        }));

        const combined = allCombinedWithNumbers.filter((item: any) => {
          if (item.isPassage) {
            if (item.questions.length === 0) return false;
            const firstQId = item.questions[0].id;
            const rating = userRatings[firstQId];
            if (folder === 'unclassified') return !rating;
            return rating === folder;
          } else {
            const rating = userRatings[item.id];
            if (folder === 'unclassified') return !rating;
            return rating === folder;
          }
        });

        setPracticeQuestions(combined);
      } else {
        if (targetIds.length === 0) {
          setPracticeQuestions([]);
          return;
        }

        const { data: questionsData } = await supabase
          .from('questions')
          .select('id, section_id, sort_order, question_type, content, correct_answer')
          .in('id', targetIds)
          .order('sort_order', { ascending: true });

        const resolved = (questionsData || []).map((q) => {
          if (subtest === 'figure_sequence') {
            const content = q.content as any;
            const { data: promptData } = supabase.storage
              .from('ExamDataset')
              .getPublicUrl(content.prompt_image || '');

            const resolvedOptions = (content.options || []).map((path: string) => {
              const { data } = supabase.storage.from('ExamDataset').getPublicUrl(path);
              return data.publicUrl;
            });

            return {
              ...q,
              content: {
                ...content,
                prompt_image_url: promptData.publicUrl,
                options_urls: resolvedOptions,
              },
            };
          } else if (subtest === 'latin_square' && q.question_type === 'latin_square') {
            const content = q.content as any;
            const { data: imgData } = supabase.storage
              .from('ExamDataset')
              .getPublicUrl(content.grid_image || '');

            return {
              ...q,
              content: {
                ...content,
                grid_image_url: imgData.publicUrl,
              },
            };
          }
          return q;
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
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading practice session...</p>
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
        onBack={() => setSelectedSubtest(null)}
        onSelectFolder={(folder) => startPracticeSession(selectedSubtest, folder)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  //Main subtest card list
  const subtests: {
    id: SubtestType;
    title: string;
    description: string;
    icon: any;
  }[] = isPaper
    ? [
        {
          id: 'figure_sequence',
          title: 'Completing Patterns',
          description: 'Train visual pattern sequence completion.',
          icon: Sparkles
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
      ]
    : [
        {
          id: 'figure_sequence',
          title: 'Figure Sequences',
          description: 'Train visual pattern recognition and transformations.',
          icon: Sparkles
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

  if (activeModule) {
    const activeModLower = activeModule.toLowerCase();
    
    if (isPaper) {
      if (activeModLower.includes('science') || activeModLower === 'cs') {
        subtests.push(
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
        subtests.push(
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
        subtests.push(
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
      subtests.push({
        id: 'module_mcq' as const,
        title: `${moduleLabel} Module`,
        description: `Practice subject-specific questions for ${moduleLabel}.`,
        icon: Laptop,
      });
    }
  }

  const getOverallStats = () => {
    let totalQuestions = 0;
    let totalEasy = 0;
    let totalMedium = 0;
    let totalHard = 0;
    let totalUnclassified = 0;
    
    let activeModuleTotal = 0;
    let activeModuleEasy = 0;
    let activeModuleMedium = 0;
    let activeModuleHard = 0;
    let activeModuleUnclassified = 0;

    subtests.forEach((sub) => {
      const counts = getSubtestCounts(sub.id);
      
      totalQuestions += counts.total;
      totalEasy += counts.easy;
      totalMedium += counts.medium;
      totalHard += counts.hard;
      totalUnclassified += counts.unclassified;

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
        activeModuleUnclassified += counts.unclassified;
      }
    });

    const totalRated = totalEasy + totalMedium + totalHard;
    const activeModuleRated = activeModuleEasy + activeModuleMedium + activeModuleHard;

    return {
      totalQuestions,
      totalEasy,
      totalMedium,
      totalHard,
      totalUnclassified,
      totalRated,
      activeModuleTotal,
      activeModuleEasy,
      activeModuleMedium,
      activeModuleHard,
      activeModuleUnclassified,
      activeModuleRated,
    };
  };

  const overallStats = getOverallStats();

  const coreSubtests = subtests.filter((sub) =>
    [
      'figure_sequence',
      'math_equation',
      'latin_square',
      'solving_quantitative',
      'inferring_relationships',
      'numerical_series',
    ].includes(sub.id)
  );

  const moduleSubtests = subtests.filter(
    (sub) =>
      ![
        'figure_sequence',
        'math_equation',
        'latin_square',
        'solving_quantitative',
        'inferring_relationships',
        'numerical_series',
      ].includes(sub.id)
  );

  const renderSubtestCard = (sub: typeof subtests[number]) => {
    const Icon = sub.icon;
    const stats = getSubtestCounts(sub.id);
    
    // Calculate percentages for stacked progress bar
    const pEasy = stats.total > 0 ? (stats.easy / stats.total) * 100 : 0;
    const pMedium = stats.total > 0 ? (stats.medium / stats.total) * 100 : 0;
    const pHard = stats.total > 0 ? (stats.hard / stats.total) * 100 : 0;
    const pUnclassified = stats.total > 0 ? (stats.unclassified / stats.total) * 100 : 100;

    return (
      <KniCard key={sub.id} className="flex min-h-64 flex-col p-6 bg-white">
        <div>
          <div className="grid size-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <Icon className="size-6" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-slate-900">{sub.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{sub.description}</p>
        </div>

        <div className="mt-6 flex-1 flex flex-col justify-end">
          {/* Stats Header */}
          <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-2">
            <span>Progress Breakdown</span>
            <span>{stats.total} total questions</span>
          </div>

          {/* Stacked Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-4 border border-slate-100 shadow-inner">
            {stats.easy > 0 && (
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pEasy}%` }} title={`Easy: ${stats.easy}`} />
            )}
            {stats.medium > 0 && (
              <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${pMedium}%` }} title={`Medium: ${stats.medium}`} />
            )}
            {stats.hard > 0 && (
              <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${pHard}%` }} title={`Hard: ${stats.hard}`} />
            )}
            {stats.unclassified > 0 && (
              <div className="h-full bg-slate-200 transition-all duration-300" style={{ width: `${pUnclassified}%` }} title={`Unclassified: ${stats.unclassified}`} />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-slate-650 mb-6">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{stats.easy} Easy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400 shrink-0" />
              <span>{stats.medium} Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
              <span>{stats.hard} Hard</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-200 shrink-0" />
              <span className="truncate">Unclassified</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedSubtest(sub.id)}
            className="w-full inline-flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800 transition hover:bg-orange-100 cursor-pointer"
          >
            Enter Practice
            <ChevronRight className="size-4" />
          </button>
        </div>
      </KniCard>
    );
  };

  const overallProgressPercent = overallStats.totalQuestions > 0 
    ? (overallStats.totalRated / overallStats.totalQuestions) * 100 
    : 0;

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
      let checkDate = userPracticeDates.has(todayStr) ? new Date() : yesterday;
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

  // LeetCode Donut Chart math
  const totalQs = overallStats.totalQuestions || 1;
  const easyPercent = (overallStats.totalEasy / totalQs) * 100;
  const mediumPercent = (overallStats.totalMedium / totalQs) * 100;
  const hardPercent = (overallStats.totalHard / totalQs) * 100;
  const unclassifiedPercent = (overallStats.totalUnclassified / totalQs) * 100;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Top Header & Metrics Section Container */}
      <div className="bg-slate-50/50 border border-slate-200/50 rounded-[32px] p-6 sm:p-8 mb-10 shadow-xs backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Difficulty Breakdown */}
          <KniCard className="flex flex-col p-6 bg-white border border-slate-200/60 rounded-[24px] shadow-xs justify-between min-h-[200px]">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Difficulty Breakdown</h3>
              <p className="text-[11px] text-slate-400 font-medium">Based on your ratings</p>
            </div>

            <div className="flex items-center gap-6 my-3">
              {/* Donut Chart */}
              <div className="relative size-24 flex items-center justify-center shrink-0">
                <svg className="size-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Base / Unclassified segment */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="3.2"
                  />
                  {/* Easy segment */}
                  {easyPercent > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.2"
                      strokeDasharray={`${easyPercent} ${100 - easyPercent}`}
                      strokeDashoffset={100}
                    />
                  )}
                  {/* Medium segment */}
                  {mediumPercent > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3.2"
                      strokeDasharray={`${mediumPercent} ${100 - mediumPercent}`}
                      strokeDashoffset={100 - easyPercent}
                    />
                  )}
                  {/* Hard segment */}
                  {hardPercent > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.2"
                      strokeDasharray={`${hardPercent} ${100 - hardPercent}`}
                      strokeDashoffset={100 - easyPercent - mediumPercent}
                    />
                  )}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-800 leading-none">
                    {overallStats.totalRated}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 mt-1 leading-none">
                    / {overallStats.totalQuestions}
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="size-2 rounded-full bg-[#10b981]" />
                    <span>Easy</span>
                  </div>
                  <span className="text-slate-850 font-bold">{overallStats.totalEasy} rated</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="size-2 rounded-full bg-[#fbbf24]" />
                    <span>Medium</span>
                  </div>
                  <span className="text-slate-850 font-bold">{overallStats.totalMedium} rated</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="size-2 rounded-full bg-[#ef4444]" />
                    <span>Hard</span>
                  </div>
                  <span className="text-slate-850 font-bold">{overallStats.totalHard} rated</span>
                </div>
              </div>
            </div>
          </KniCard>

          {/* Card 2: Overall Progress */}
          <KniCard className="flex flex-col p-6 bg-white border border-slate-200/60 rounded-[24px] shadow-xs justify-between min-h-[200px]">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Overall Progress</h3>
              <p className="text-[11px] text-slate-400 font-medium">Question bank completion</p>
            </div>

            <div className="flex flex-col items-center justify-center my-3 text-center">
              <span className="text-3xl font-extrabold text-slate-850 leading-none">
                {Math.round(overallProgressPercent)}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                Completion Rate
              </span>
            </div>

            <div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-100 shadow-inner mb-1">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-450 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>0 questions</span>
                <span>{overallStats.totalQuestions} total</span>
              </div>
              <p className="text-xs font-bold text-slate-500 text-center">
                {overallStats.totalRated} of {overallStats.totalQuestions} questions rated
              </p>
            </div>
          </KniCard>

          {/* Card 3: Activity Streak */}
          <KniCard className="flex flex-col p-6 bg-white border border-slate-200/60 rounded-[24px] shadow-xs justify-between min-h-[200px]">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Activity Streak</h3>
              <p className="text-[11px] text-slate-400 font-medium">Practice frequency</p>
            </div>

            <div className="my-2.5">
              <div className="flex items-center gap-1.5 justify-start">
                <span className="text-3xl font-extrabold text-slate-900 leading-none">
                  {currentStreak}
                </span>
                <Flame className="size-7 text-orange-500 fill-orange-100 shrink-0" />
              </div>
              <p className="text-sm font-extrabold text-slate-800 mt-1">Day Streak!</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Max Streak: {maxStreak} days</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, idx) => {
                  const isActive = weekCheckedIn[idx];
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div
                        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-orange-500 border border-orange-500 text-white shadow-sm shadow-orange-100'
                            : 'bg-white border border-slate-200 text-slate-400'
                        }`}
                      >
                        {isActive ? (
                          <Check className="size-4 stroke-[3]" />
                        ) : (
                          dayLabel
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
                Checked in {weeklyActiveCount} of 7 days this week
              </p>
            </div>
          </KniCard>
        </div>
      </div>

      {/* Core Test Section */}
      {coreSubtests.length > 0 && (
        <div className="mb-12">
          <div className="my-2 pb-2 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="h-6 w-1 bg-orange-500 rounded-full" />
              Core Test Subtests
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              General cognitive abilities required for all academic studies.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coreSubtests.map(renderSubtestCard)}
          </div>
        </div>
      )}

      {/* Subject-Specific Module Focus Section */}
      {moduleSubtests.length > 0 && (
        <div id="subject-module-focus">
          <div className="mb-5 pb-2 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="h-6 w-1 bg-orange-500 rounded-full" />
              Subject-Specific Module Focus
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Practice for the {activeModule ? (activeModule.includes('science') || activeModule === 'CS' ? 'Natural Science & Computer Science' : activeModule) : 'chosen'} module.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {moduleSubtests.map(renderSubtestCard)}
          </div>
        </div>
      )}
    </div>
  );
}

