'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, FileText, Layers, Laptop, ChevronRight, BookOpen, Clock } from 'lucide-react';
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

  // Navigation State inside SPA
  const [selectedSubtest, setSelectedSubtest] = useState<'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq' | null>(null);
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

      // 3. Fetch user ratings
      const { data: rData } = await supabase
        .from('user_question_practices')
        .select('question_id, difficulty')
        .eq('user_id', profile.id);

      const ratingMap: Record<string, 'easy' | 'medium' | 'hard'> = {};
      if (rData) {
        rData.forEach((row) => {
          ratingMap[row.question_id] = row.difficulty as 'easy' | 'medium' | 'hard';
        });
      }
      setUserRatings(ratingMap);
    } catch (err) {
      console.error('Failed to load practice data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, supabase]);

  useEffect(() => {
    loadPracticeData();
  }, [loadPracticeData]);

  // Compute question counts for a specific subtest type
  const getSubtestCounts = (subtest: 'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq') => {
    // Filter questions belonging to this subtest
    let subtestQuestions = [];
    if (subtest === 'module_mcq') {
      const moduleTitle = getModuleTitle(activeModule);
      const matchedSections = sections.filter(s => s.question_type === 'module_mcq' && s.title === moduleTitle);
      const matchedSectionIds = new Set(matchedSections.map(s => s.id));
      subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));
    } else {
      subtestQuestions = questions.filter(q => q.question_type === subtest);
    }

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

  const getQuestionIdsForFolder = (subtest: string, folder: string) => {
    let subtestQuestions = [];
    if (subtest === 'module_mcq') {
      const moduleTitle = getModuleTitle(activeModule);
      const matchedSections = sections.filter(s => s.question_type === 'module_mcq' && s.title === moduleTitle);
      const matchedSectionIds = new Set(matchedSections.map(s => s.id));
      subtestQuestions = questions.filter(q => matchedSectionIds.has(q.section_id));
    } else {
      subtestQuestions = questions.filter(q => q.question_type === subtest);
    }

    return subtestQuestions
      .filter((q) => {
        const rating = userRatings[q.id];
        if (folder === 'unclassified') return !rating;
        return rating === folder;
      })
      .map((q) => q.id);
  };

  const startPracticeSession = async (subtest: 'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq', folder: 'easy' | 'medium' | 'hard' | 'unclassified') => {
    setIsLoadingSession(true);
    setSelectedFolder(folder);
    try {
      const targetIds = getQuestionIdsForFolder(subtest, folder);

      if (subtest === 'module_mcq') {
        const moduleTitle = getModuleTitle(activeModule);
        const section = sections.find(s => s.question_type === 'module_mcq' && s.title === moduleTitle);
        if (!section) throw new Error('No section found for this module');

        const { data: passagesData } = await supabase
          .from('passages')
          .select('*')
          .eq('section_id', section.id)
          .order('sort_order', { ascending: true });

        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .eq('section_id', section.id)
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
          };
        });

        const filteredPassages = formattedPassages.filter((passage: any) => {
          if (passage.questions.length === 0) return false;
          const firstQId = passage.questions[0].id;
          const rating = userRatings[firstQId];

          if (folder === 'unclassified') {
            return !rating;
          }
          return rating === folder;
        });

        setPracticeQuestions(filteredPassages);
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
          } else if (subtest === 'latin_square') {
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

    const subtestTitles = {
      figure_sequence: 'Figure Sequences',
      math_equation: 'Mathematical Equations',
      latin_square: 'Latin Squares',
      module_mcq: activeModule ? (activeModule.includes('science') || activeModule === 'CS' ? 'Natural Science & CS Module' : activeModule) : 'Subject Module',
    };

    return (
      <PracticeSession
        subtestType={selectedSubtest}
        subtestTitle={subtestTitles[selectedSubtest]}
        folderId={selectedFolder}
        questions={practiceQuestions}
        userId={profile?.id || ''}
        supabase={supabase}
        onExit={handleExitPracticeSession}
        onQuestionRated={loadPracticeData}
      />
    );
  }

  if (selectedSubtest) {
    const subtestTitles = {
      figure_sequence: 'Figure Sequences',
      math_equation: 'Mathematical Equations',
      latin_square: 'Latin Squares',
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
    id: 'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq';
    title: string;
    description: string;
    icon: any;
  }[] = [
    { id: 'figure_sequence', title: 'Figure Sequences', description: 'Train visual pattern recognition and transformations.', icon: Sparkles },
    { id: 'math_equation', title: 'Mathematical Equations', description: 'Practice quantitative relationships and equation logic.', icon: FileText },
    { id: 'latin_square', title: 'Latin Squares', description: 'Strengthen rule deduction and symbolic reasoning.', icon: Layers },
  ];

  if (activeModule) {
    const moduleLabel = activeModule.includes('science') || activeModule === 'CS' ? 'Natural & Computer Science' : activeModule;
    subtests.push({
      id: 'module_mcq' as const,
      title: `${moduleLabel} Module`,
      description: `Practice subject-specific questions for ${moduleLabel}.`,
      icon: Laptop,
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-orange-700">Practice Center</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900">Build skills one subtest at a time</h2>
        <p className="mt-2 text-slate-500">
          Focused practice is separate from the timed mock exam and does not use a mock-test attempt.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {subtests.map((sub) => {
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
                    <span>{stats.easy} Dễ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                    <span>{stats.medium} Vừa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                    <span>{stats.hard} Khó</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-slate-200 shrink-0" />
                    <span className="truncate">Chưa đánh giá</span>
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
        })}
      </div>
    </div>
  );
}
