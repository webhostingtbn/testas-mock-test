'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useExamStore } from '@/lib/store/exam-store';
import { createClient } from '@/lib/supabase/client';
import ExamTopBar from '@/components/exam/ExamTopBar';
import ExamBottomBar from '@/components/exam/ExamBottomBar';
import BreakScreen from '@/components/exam/BreakScreen';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import CompletingPatterns from '@/components/question-types/CompletingPatterns';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';
import ModuleQuestion from '@/components/question-types/ModuleQuestion';
import NumericalSeries from '@/components/question-types/NumericalSeries';
import { getMockQuestions } from '@/lib/mock-data';
import RatingWidget from '@/components/exam/RatingWidget';
import SecurityOverlay from '@/components/exam/SecurityOverlay';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';

const STORAGE_BUCKET = 'ExamDataset';

export default function ExamPage() {
  const router = useRouter();
  const { data: session } = useSession();
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
    getRating,
    setRating,
  } = useExamStore();

  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ email: string; fullName: string | null } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const email = session?.user?.email;
      if (!email) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('email', email)
          .maybeSingle();
        if (data) {
          setUserProfile({
            email: data.email,
            fullName: data.full_name,
          });
        } else {
          setUserProfile({
            email: email,
            fullName: session?.user?.name || null,
          });
        }
      } catch (err) {
        console.error('Failed to fetch user profile for watermark:', err);
        setUserProfile({
          email: email,
          fullName: session?.user?.name || null,
        });
      }
    }
    
    async function resolveUserId() {
      if (session?.user?.id) {
        setUserId(session.user.id);
        return;
      }
      if (session?.user?.email) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', session.user.email)
            .maybeSingle();
          if (data?.id) {
            setUserId(data.id);
          }
        } catch (err) {
          console.error('Failed to resolve user ID by email:', err);
        }
      }
    }

    if (session) {
      fetchProfile();
      resolveUserId();
    }
  }, [session, supabase]);

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
      if (
        section.questionType === 'module_mcq' ||
        section.questionType === 'interpreting_texts' ||
        section.questionType === 'representation_systems' ||
        section.questionType === 'linguistic_structures'
      ) {
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

        const formattedPassages = (passagesData || []).map((passage: any) => {
          const pQuestions = (questionsData || [])
            .filter((q: any) => q.passage_id === passage.id)
            .map((q: any) => {
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

      // Comprehensive storage path resolver for all non-passage questions
      const resolved = data.map((q: any) => {
        const content = (q.content as any) || {};
        const newContent = { ...content };

        // 1. Resolve prompt_image (FigureSequence)
        if (content.prompt_image) {
          const { data: promptData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(content.prompt_image);
          newContent.prompt_image_url = promptData.publicUrl;
        }

        // 2. Resolve options as image paths (FigureSequence options_urls)
        if (content.options && Array.isArray(content.options) && section.questionType === 'figure_sequence') {
          newContent.options_urls = content.options.map((path: string) => {
            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            return data.publicUrl;
          });
        }

        // 3. Resolve grid_image (LatinSquare & CompletingPatterns)
        if (content.grid_image) {
          const { data: gridData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(content.grid_image);
          newContent.grid_image_url = gridData.publicUrl;
        }

        // 4. Resolve options_image (CompletingPatterns)
        if (content.options_image) {
          const { data: optionsImgData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(content.options_image);
          newContent.options_image_url = optionsImgData.publicUrl;
        }

        // 5. Resolve question_image (ModuleQuestion)
        if (content.question_image) {
          if (!content.question_image.startsWith('http') && !content.question_image.startsWith('/')) {
            const { data: qImgData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(content.question_image);
            newContent.question_image = qImgData.publicUrl;
          }
        }

        // 6. Resolve image_url (ModuleQuestion / standard)
        if (content.image_url) {
          if (!content.image_url.startsWith('http') && !content.image_url.startsWith('/')) {
            const { data: imgData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(content.image_url);
            newContent.image_url = imgData.publicUrl;
          }
        }

        // 7. Resolve option images inside standard MCQ options (ModuleQuestion options)
        if (content.options && typeof content.options === 'object') {
          if (Array.isArray(content.options)) {
            newContent.options = content.options.map((opt: any) => {
              if (opt && typeof opt === 'object' && opt.image) {
                if (!opt.image.startsWith('http') && !opt.image.startsWith('/')) {
                  const { data: optImgData } = supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(opt.image);
                  return { ...opt, image: optImgData.publicUrl };
                }
              }
              return opt;
            });
          } else {
            // Key-value options
            const updatedOptions: any = {};
            for (const [key, val] of Object.entries(content.options)) {
              if (val && typeof val === 'object' && (val as any).image) {
                const optImage = (val as any).image;
                if (!optImage.startsWith('http') && !optImage.startsWith('/')) {
                  const { data: optImgData } = supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(optImage);
                  updatedOptions[key] = { ...(val as any), image: optImgData.publicUrl };
                } else {
                  updatedOptions[key] = val;
                }
              } else {
                updatedOptions[key] = val;
              }
            }
            newContent.options = updatedOptions;
          }
        }

        return {
          ...q,
          content: newContent,
        };
      });
      setSectionQuestions(resolved);
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
  
  const currentRating = currentQuestion.isPassage && currentQuestion.questions && currentQuestion.questions.length > 0
    ? getRating(section.id, currentQuestion.questions[0].id)
    : getRating(section.id, currentQuestion.id);

  const isCurrentQuestionRated = currentRating !== null && currentRating !== undefined;

  const handleAnswer = (answer: unknown) => {
    setAnswer(section.id, currentQuestion.id, answer);
  };

  const handleRatingChange = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (currentQuestion.isPassage && currentQuestion.questions) {
      currentQuestion.questions.forEach((childQ: any) => {
        setRating(section.id, childQ.id, difficulty);
      });
    } else {
      setRating(section.id, currentQuestion.id, difficulty);
    }
    
    if (userId) {
      try {
        const questionIdsToSync = currentQuestion.isPassage && currentQuestion.questions
          ? currentQuestion.questions.map((childQ: any) => childQ.id)
          : [currentQuestion.id];

        const upsertData = questionIdsToSync.map((qId: string) => ({
          user_id: userId,
          question_id: qId,
          difficulty: difficulty,
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
          .from('user_question_practices')
          .upsert(upsertData, { onConflict: 'user_id,question_id' });

        if (error) throw error;
      } catch (err) {
        console.error('Failed to sync difficulty rating to database:', err);
      }
    }
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
      case 'completing_patterns':
        return (
          <CompletingPatterns
            question={q}
            selectedAnswer={currentAnswer as string | null}
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
      case 'completing_patterns':
      case 'completing patterns':
        return (
          <CompletingPatterns
            question={q}
            selectedAnswer={currentAnswer as string | null}
            onAnswer={handleAnswer}
          />
        );
      case 'figure_sequence':
      case 'figure sequence':
        return (
          <FigureSequence
            question={q}
            selectedAnswer={currentAnswer as any}
            onAnswer={handleAnswer}
          />
        );
      case 'math_equation':
        return (
          <MathEquation
            question={q}
            currentAnswer={currentAnswer as any}
            onAnswer={handleAnswer}
          />
        );
      case 'module_mcq':
      case 'interpreting_texts':
      case 'representation_systems':
      case 'linguistic_structures':
        return (
          <ModuleMCQ
            passage={q}
            selectedAnswers={answers[section.id] as Record<string, string> || {}}
            onAnswer={(questionId, val) => setAnswer(section.id, questionId, val)}
          />
        );
      case 'numerical_series':
        return (
          <NumericalSeries
            question={q}
            selectedAnswer={currentAnswer as string | null}
            onAnswer={(val) => handleAnswer(val)}
          />
        );
      case 'solving_quantitative':
      case 'inferring_relationships':
      case 'visualising_solids':
      case 'visualizing_solids':
      case 'visualising solids':
      case 'visualizing solids':
      case 'visualising solids - 2d':
      case 'visualizing solids - 2d':
      case 'visualising solids - 3d':
      case 'visualizing solids - 3d':
      default:
        return (
          <ModuleQuestion
            question={q}
            selectedAnswer={currentAnswer as string | null}
            onAnswer={(optionId) => handleAnswer(optionId)}
          />
        );
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
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden" style={{ fontSize: `${fontSize}px` }}>
      <SecurityOverlay />
      {userProfile && (
        <WatermarkOverlay 
          email={userProfile.email} 
          fullName={userProfile.fullName} 
        />
      )}
      <ExamTopBar
        sectionTitle={section.title}
        totalQuestions={sectionQuestions.length}
        currentQuestionIndex={currentQuestionIndex}
        answeredQuestions={answeredIndices}
        onQuestionClick={goToQuestion}
        onTimeUp={handleTimeUp}
        isCurrentQuestionRated={isCurrentQuestionRated}
      />

      {/* Preload all images for the section so switching questions is instantaneous */}
      <div className="hidden" aria-hidden="true">
        {sectionQuestions.map(q => {
          const url = q.content?.prompt_image_url || q.content?.grid_image_url || q.content?.question_image || q.content?.image_url || q.resolved_image_url;
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

      <main className="flex-1 min-h-0 flex overflow-hidden bg-slate-50">
        <div className="flex-1 overflow-y-auto w-full px-6 py-4 text-slate-800 pb-24">
          <div className="mx-auto">
            {renderQuestion()}
          </div>
        </div>
      </main>

      <ExamBottomBar
        onBack={prevQuestion}
        onNext={nextQuestion}
        onEndSubtest={handleEndSubtest}
        isFirstQuestion={currentQuestionIndex === 0}
        isLastQuestion={currentQuestionIndex === sectionQuestions.length - 1}
        sectionTitle={section.title}
        isCurrentQuestionRated={isCurrentQuestionRated}
        currentRating={currentRating}
        onRatingChange={handleRatingChange}
      />
    </div>
  );
}
