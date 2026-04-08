'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/lib/store/exam-store';
import { createClient } from '@/lib/supabase/client';
import ExamTopBar from '@/components/exam/ExamTopBar';
import ExamBottomBar from '@/components/exam/ExamBottomBar';
import BreakScreen from '@/components/exam/BreakScreen';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';
import { getMockQuestions } from '@/lib/mock-data';

const STORAGE_BUCKET = 'ExamDataset';

export default function ExamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [hydrated, setHydrated] = useState(false);
  const [sectionQuestions, setSectionQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const {
    currentExamId,
    sections,
    flowSteps,
    currentFlowStepIndex,
    currentSectionIndex,
    currentQuestionIndex,
    answers,
    fontSize,
    startSection,
    startBreak,
    advanceFlowStep,
    setAnswer,
    getAnswer,
    nextQuestion,
    prevQuestion,
    goToQuestion,
  } = useExamStore();

  // Wait for zustand hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // If no exam is active, redirect to dashboard
  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push('/dashboard');
    }
  }, [hydrated, currentExamId, router]);

  // Auto-start the first flow step
  useEffect(() => {
    if (!hydrated || !currentExamId) return;

    const currentStep = flowSteps[currentFlowStepIndex];
    if (!currentStep) return;

    if (currentStep.type === 'section' && currentStep.sectionIndex !== undefined) {
      const store = useExamStore.getState();
      if (!store.sectionStartTime) {
        startSection(currentStep.sectionIndex);
      }
    } else if (currentStep.type === 'break' && currentStep.breakDuration) {
      const store = useExamStore.getState();
      if (!store.breakStartTime) {
        startBreak(currentStep.breakDuration);
      }
    }
  }, [hydrated, currentExamId, currentFlowStepIndex, flowSteps, startSection, startBreak]);

  // Fetch questions from Supabase when the section changes
  const fetchQuestionsForSection = useCallback(async (section: typeof sections[0]) => {
    setIsLoadingQuestions(true);
    try {
      if (section.questionType === 'module_mcq') {
        const { data: passagesData, error: pError } = await supabase
          .from('passages')
          .select('*')
          .eq('section_id', section.id)
          .order('sort_order', { ascending: true });

        if (pError) throw pError;

        const { data: questionsData, error: qError } = await supabase
          .from('questions')
          .select('id, section_id, sort_order, question_type, content, correct_answer, passage_id')
          .eq('section_id', section.id)
          .order('sort_order', { ascending: true });

        if (qError) throw qError;

        const formattedPassages = (passagesData || []).map((passage) => {
          const pQuestions = (questionsData || [])
            .filter((q) => q.passage_id === passage.id)
            .map((q) => {
              const content = (q.content as any) || {};
              let qResolvedUrl;
              if (content.image_url) {
                const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(content.image_url);
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
             const { data: imgData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(passage.image_url);
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

        setSectionQuestions(formattedPassages);
        setIsLoadingQuestions(false);
        return;
      }

      const { data, error } = await supabase
        .from('questions')
        .select('id, sort_order, question_type, content, correct_answer')
        .eq('section_id', section.id)
        .order('sort_order', { ascending: true });

      if (error || !data) throw error;

      // For figure_sequence, resolve storage image URLs
      if (section.questionType === 'figure_sequence') {
        const resolved = data.map((q) => {
          const content = q.content as { prompt_image?: string; options?: string[] };
          const { data: promptData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(content.prompt_image || '');
            
          const resolvedOptions = (content.options || []).map((path) => {
            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
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
        });
        setSectionQuestions(resolved);
      } else if (section.questionType === 'latin_square') {
        const resolved = data.map((q) => {
          const content = q.content as { grid_image?: string };
          const { data: imgData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(content.grid_image || '');
            
          return {
            ...q,
            content: {
              ...content,
              grid_image_url: imgData.publicUrl,
            },
          };
        });
        setSectionQuestions(resolved);
      } else {
        setSectionQuestions(data);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
      // Fallback to mock data
      setSectionQuestions(getMockQuestions(section.questionType, section.questionCount));
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!hydrated || !currentExamId) return;
    const section = sections[currentSectionIndex];
    if (section) {
      fetchQuestionsForSection(section);
    }
  }, [hydrated, currentExamId, currentSectionIndex, sections, fetchQuestionsForSection]);

  // Navigate to results when all flow steps are completed
  useEffect(() => {
    if (!hydrated || !currentExamId) return;
    const currentStep = flowSteps[currentFlowStepIndex];
    if (!currentStep) {
      router.push('/results');
    }
  }, [hydrated, currentExamId, currentFlowStepIndex, flowSteps, router]);

  if (!hydrated || !currentExamId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const currentStep = flowSteps[currentFlowStepIndex];

  // All steps completed — wait for useEffect to push to results
  if (!currentStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Handle break screen
  if (currentStep.type === 'break') {
    return (
      <BreakScreen
        onSkip={() => advanceFlowStep()}
        onComplete={() => advanceFlowStep()}
      />
    );
  }

  // Section rendering
  const section = sections[currentSectionIndex];
  if (!section) return null;

  if (isLoadingQuestions || sectionQuestions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading questions...</p>
      </div>
    );
  }

  const currentQuestion = sectionQuestions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const currentAnswer = getAnswer(section.id, currentQuestion.id);

  const handleAnswer = (answer: unknown) => {
    setAnswer(section.id, currentQuestion.id, answer);
  };

  const handleTimeUp = () => {
    advanceFlowStep();
  };

  const handleEndSubtest = () => {
    advanceFlowStep();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = currentQuestion as any;

  const renderQuestion = () => {
    switch (section.questionType) {
      case 'figure_sequence':
        return (
          <FigureSequence
            question={q}
            selectedAnswer={currentAnswer as { image1: number | null; image2: number | null } | null}
            onAnswer={handleAnswer}
          />
        );
      case 'math_equation':
        return (
          <MathEquation
            question={q}
            currentAnswer={currentAnswer as Record<string, number> | null}
            onAnswer={handleAnswer}
          />
        );
      case 'latin_square':
        return (
          <LatinSquare
            question={q}
            selectedAnswer={currentAnswer as string | null}
            onAnswer={handleAnswer}
          />
        );
      case 'module_mcq':
        return (
          <ModuleMCQ
            passage={q}
            selectedAnswers={answers[section.id] as Record<string, string> || {}}
            onAnswer={(questionId, val) => setAnswer(section.id, questionId, val)}
          />
        );
      default:
        return <div className="text-center text-gray-500 py-20">Unknown question type</div>;
    }
  };

  // Build answered question indices for the top bar
  const answeredIndices = sectionQuestions
    .map((q, idx) => {
      // For Module MCQ, the item is a Passage. It is "answered" if ALL child questions are answered.
      if (q.isPassage && q.questions) {
        const allAnswered =
          q.questions.length > 0 &&
          q.questions.every((childQ: any) => {
            const ans = getAnswer(section.id, childQ.id);
            return ans !== null && ans !== undefined;
          });
        return allAnswered ? idx : -1;
      }

      // Standard questions
      const ans = getAnswer(section.id, q.id);
      return ans !== null && ans !== undefined ? idx : -1;
    })
    .filter((i) => i >= 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50" style={{ fontSize: `${fontSize}px` }}>
      <ExamTopBar
        sectionTitle={section.title}
        totalQuestions={sectionQuestions.length}
        currentQuestionIndex={currentQuestionIndex}
        answeredQuestions={answeredIndices}
        onQuestionClick={goToQuestion}
        onTimeUp={handleTimeUp}
      />

      {/* Preload all images for the section so switching questions is instantaneous */}
      <div className="hidden" aria-hidden="true">
        {sectionQuestions.map(q => {
          const url = q.content?.prompt_image_url || q.content?.grid_image_url || q.resolved_image_url;
          const opts = q.content?.options_urls || [];
          const childQuestions = q.questions || [];
          return (
            <div key={q.id}>
              {url && <img src={url} alt="" />}
              {opts.map((optUrl: string, idx: number) => (
                <img key={idx} src={optUrl} alt="" />
              ))}
              {childQuestions.map((child: any) => (
                child.content?.resolved_image_url && <img key={child.id} src={child.content.resolved_image_url} alt="" />
              ))}
            </div>
          );
        })}
      </div>

      {/* Question content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto px-6 py-6">
          {renderQuestion()}
        </div>
      </main>

      <ExamBottomBar
        onBack={prevQuestion}
        onNext={nextQuestion}
        onEndSubtest={handleEndSubtest}
        isFirstQuestion={currentQuestionIndex === 0}
        isLastQuestion={currentQuestionIndex === sectionQuestions.length - 1}
        sectionTitle={section.title}
      />
    </div>
  );
}
