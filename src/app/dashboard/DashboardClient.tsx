"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useExamStore } from '@/lib/store/exam-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MAJOR_LABELS, MODULE_TEST_LABELS, SECTION_DURATIONS, BREAK_DURATIONS } from '@/lib/constants';
import type { Profile, ModuleTestType } from '@/lib/types';
import type { Session } from 'next-auth';
import { 
  GraduationCap, Play, ChevronRight, Clock, FileText, Layers, Timer, LogOut,
  ChevronDown, ChevronUp, History
} from 'lucide-react';

export default function DashboardClient({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [pastExams, setPastExams] = useState<any[]>([]);
  const [isStructureOpen, setIsStructureOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [examLimit, setExamLimit] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { startExam, currentExamId, resetExam } = useExamStore();
  // We'll calculate active module based on either URL param or profile
  const [activeModule, setActiveModule] = useState<ModuleTestType | null>(null);

  useEffect(() => {
    async function loadProfile() {
      // Check if in dev bypass mode
      const urlParams = new URLSearchParams(window.location.search);
      const isDevBypass = urlParams.get('dev') === 'true';

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isDevBypass) {
            // Use mock profile in dev mode
            setProfile({
              id: 'dev-user',
              email: 'dev@example.com',
              full_name: 'Dev Student',
              avatar_url: null,
              major: 'economics',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            setIsLoading(false);
            return;
          }
          router.push('/login');
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setProfile(data as Profile);
          if (data.module_test && !searchParams.get('module')) {
            // Also optionally set the active module immediately if found in DB
            setActiveModule(data.module_test as ModuleTestType);
          }
        }

        // Fetch past exams
        const { data: examsData } = await supabase
          .from('user_exams')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (examsData) {
          setPastExams(examsData);
        }

        // Fetch exam settings
        const { data: examData } = await supabase
          .from('exams')
          .select('retry_number')
          .eq('id', '118ec3ca-b52e-4069-b5dd-eaca31339932')
          .maybeSingle();

        if (examData && examData.retry_number !== null) {
          setExamLimit(examData.retry_number);
        }
      } catch {
        // Auth failed — use mock profile for dev
        setProfile({
          id: 'dev-user',
          email: 'dev@example.com',
          full_name: 'Dev Student',
          avatar_url: null,
          major: 'economics',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      setIsLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  useEffect(() => {
    if (profile) {
      const urlModule = searchParams.get('module') as ModuleTestType | null;
      setActiveModule(urlModule || profile.module_test || null);
    }
  }, [profile, searchParams]);

  // If no module selected, redirect back to select-module
  useEffect(() => {
    if (!isLoading && profile && !activeModule) {
      router.push('/select-module');
    }
  }, [isLoading, activeModule, profile, router]);

  const handleStartExam = async () => {
    setIsStarting(true);

    try {
      const EXAM_ID = '118ec3ca-b52e-4069-b5dd-eaca31339932';

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
    await supabase.auth.signOut();
    resetExam();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const examSections = [
    {
      title: 'Core Test 1: Figure Sequences',
      duration: '20 min',
      questions: 20,
      icon: '🔷',
    },
    {
      title: 'Break',
      duration: '2 min',
      isBreak: true,
    },
    {
      title: 'Core Test 2: Mathematical Equations',
      duration: '25 min',
      questions: 20,
      icon: '🔢',
    },
    {
      title: 'Break',
      duration: '2 min',
      isBreak: true,
    },
    {
      title: 'Core Test 3: Latin Squares',
      duration: '20 min',
      questions: 20,
      icon: '🔤',
    },
    {
      title: 'Long Break',
      duration: '30 min',
      isBreak: true,
    },
    {
      title: `Module: ${MODULE_TEST_LABELS[activeModule || ''] || 'Module Test'}`,
      duration: '150 min',
      questions: '40-60',
      icon: '📋',
    },
  ];

  const totalTime = '~4 hours';

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-amber-50">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.avif" alt="TestAS Logo" className="w-12 h-auto" />
            <div>
              <h1 className="font-bold text-gray-900">TestAS Mock Test</h1>
              <p className="text-xs text-gray-500">Digital Exam Practice</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-orange-600 font-medium">
                {MODULE_TEST_LABELS[activeModule || ''] || 'No module selected'}
              </p>
            </div>
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-10 h-10 rounded-full border-2 border-orange-200"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-4">
        {/* Welcome Section */}
        <div className="mb-4 flex items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Ready to practice?
            </h2>
            <p className="text-gray-500 text-lg">
              Complete the full mock test to simulate real exam conditions.
              {examLimit !== null && (
                <span className="block mt-1 text-sm font-medium text-orange-600">
                  {pastExams.length} / {examLimit} attempts used
                </span>
              )}
            </p>
          </div>
          
          {examLimit !== null && pastExams.length >= examLimit ? (
            <Button
              disabled
              size="lg"
              className="shrink-0 h-14 px-10 text-base font-semibold bg-gray-200 text-gray-400 cursor-not-allowed"
            >
              Retakes Exhausted
            </Button>
          ) : (
            <Button
              onClick={handleStartExam}
              disabled={isStarting}
              size="lg"
              className="shrink-0 h-14 px-10 text-base font-semibold bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xl shadow-orange-200 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isStarting ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Play className="w-5 h-5" />
                  Start Exam
                </div>
              )}
            </Button>
          )}
        </div>

        {/* Instructions */}
        <Card className="border-0 bg-amber-50/80 backdrop-blur-sm shadow-md mb-4 border-l-4 border-l-orange-400">
          <CardContent className="">
            <h3 className="font-bold text-orange-800 mb-3">📋 Important Instructions</h3>
            <ul className="space-y-2 text-sm text-orange-900/80">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>Once started, the timer <strong>cannot be paused</strong>. Closing the browser will not stop it.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>Navigate freely between questions within each section using the number bar.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>You <strong>cannot go back</strong> to a previous section after submitting or when time expires.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>Answers are saved automatically — don&apos;t worry about losing progress.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <span>Results will only be shown after completing <strong>all sections</strong>.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Exam Overview Cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-md">
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalTime}</p>
              <p className="text-sm text-gray-500">Total Duration</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-md">
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">80</p>
              <p className="text-sm text-gray-500">Total Questions</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-md">
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">4</p>
              <p className="text-sm text-gray-500">Sections</p>
            </CardContent>
          </Card>
        </div>

        {/* Exam Structure Timeline */}
        <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-lg mb-4 overflow-hidden">
          <CardContent className="p-0">
            <button 
              onClick={() => setIsStructureOpen(!isStructureOpen)}
              className="w-full flex items-center justify-between px-6 bg-white/50 hover:bg-white/80 transition-colors"
            >
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Timer className="w-5 h-5 text-orange-500" />
                Exam Structure
              </h3>
              {isStructureOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {isStructureOpen && (
              <div className="space-y-1 px-6 pb-6 pt-2">
                {examSections.map((section, idx) => (
                  <div key={idx} className={`flex items-center gap-4 py-3 px-4 rounded-lg border transition-all ${
                    section.isBreak
                      ? 'bg-gray-50/80 border-dashed border-gray-200'
                      : 'bg-white border-gray-100 hover:border-orange-100'
                  }`}>
                    {/* Step indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ${
                      section.isBreak
                        ? 'bg-gray-200 text-gray-500'
                        : 'bg-orange-100 text-orange-600'
                    }`}>
                      {section.isBreak ? '☕' : section.icon}
                    </div>

                    <div className="flex-1">
                      <p className={`font-medium ${section.isBreak ? 'text-gray-400 text-sm' : 'text-gray-800'}`}>
                        {section.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {section.questions && (
                        <span className="bg-orange-50/50 text-orange-700/80 px-2.5 py-1 rounded-md text-xs font-semibold border border-orange-100/50">
                          {section.questions} Qs
                        </span>
                      )}
                      <span className="font-semibold text-gray-600 w-16 text-right">{section.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test History */}
        {/* <Card className="border-0 bg-white/70 backdrop-blur-sm shadow-lg mb-4 overflow-hidden">
          <CardContent className="p-0">
            <button 
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="w-full flex items-center justify-between px-6 bg-white/50 hover:bg-white/80 transition-colors"
            >
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Test History
              </h3>
              {isHistoryOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {isHistoryOpen && (
              <div className="px-6 pb-6 pt-2">
                {pastExams.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No past exams found</p>
                    <p className="text-sm text-gray-400 mt-1">Complete a mock test to see your history here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastExams.map((exam) => (
                      <div key={exam.id} className="flex justify-between items-center py-4 px-5 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                        <div>
                          <p className="font-semibold text-gray-800">
                            Mock Test Practice
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(exam.created_at).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'long', day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          {exam.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-green-50 text-green-600 border border-green-200">
                              {exam.total_score !== null 
                                ? `${Math.round((exam.total_score / (exam.max_score || 1)) * 100)}%` 
                                : 'Completed'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card> */}


      </main>
    </div>
  );
}
