'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useExamStore } from '@/lib/store/exam-store';
import { createClient } from '@/lib/supabase/client';
import ExamTopBar from '@/components/exam/ExamTopBar';
import ExamBottomBar from '@/components/exam/ExamBottomBar';
import BreakScreen from '@/components/exam/BreakScreen';
import { getMockQuestions } from '@/lib/mock-data';
import RatingWidget from '@/components/exam/RatingWidget';
import SecurityOverlay from '@/components/exam/SecurityOverlay';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import { questionRendererFactory, QuestionData } from '@/lib/exam/renderer';
import { ImageService } from '@/lib/services/image-service';

export default function ExamPage() {
  const imageService = new ImageService();
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

        const formattedPassages = await Promise.all(
          (passagesData || []).map(async (passage: any) => {
            const pQuestions = (questionsData || [])
              .filter((q: any) => q.passage_id === passage.id)
              .map(async (q: any) => {
                const content = (q.content as any) || {};
                return {
                  ...q,
                  content: {
                    ...content,
                    resolved_image_url: content.image_url ? await imageService.resolveImageUrl(content.image_url) : undefined,
                  },
                };
              });

            const resolvedUrl = passage.image_url ? await imageService.resolveImageUrl(passage.image_url) : undefined;

            return {
               id: passage.id,
               isPassage: true,
               title: passage.title,
               body_markdown: passage.body_markdown,
               image_url: passage.image_url,
               resolved_image_url: resolvedUrl,
               questions: await Promise.all(pQuestions),
            };
          }),
        );

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

      // Use ImageService to resolve all image paths to full URLs
      const resolved = await imageService.resolveQuestionImageUrls(data);
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

  // Build QuestionData object for the renderer
  const buildQuestionData = (): QuestionData => {
    const q = currentQuestion as QuestionData & Record<string, unknown>;
    return {
      id: q.id,
      sectionId: section.id,
      sortOrder: (q.sort_order as number ?? q.sortOrder) || 0,
      questionType: section.questionType,
      content: q.content,
      isPassage: q.isPassage || false,
      questions: q.questions || undefined,
      // Forward top-level passage fields so toModulePassage can read them
      ...(q.isPassage ? {
        title: q.title,
        body_markdown: q.body_markdown,
        image_url: q.image_url,
        resolved_image_url: q.resolved_image_url,
      } : {}),
    };
  };

  const renderQuestion = () => {
    const questionData = buildQuestionData();

    // Handle Module MCQ passages specially - pass the full passage structure
    if (questionData.isPassage) {
      return questionRendererFactory.render(questionData, {
        selectedAnswer: null,
        selectedAnswers: answers[section.id] as Record<string, string> || {},
        onAnswer: (val: unknown) => {
          // For passage-based questions, val is { [questionId]: answer }
          if (typeof val === 'object' && val !== null) {
            const entries = Object.entries(val);
            if (entries.length > 0) {
              const [questionId, answer] = entries[0];
              setAnswer(section.id, questionId, answer);
            }
          }
        },
        passage: questionData,
      });
    }

    return questionRendererFactory.render(questionData, {
      selectedAnswer: currentAnswer,
      onAnswer: handleAnswer,
    });
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
      {/* <SecurityOverlay /> */}
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
                <img key={`${q.id}-opt-${idx}`} src={optUrl} alt="" />
              ))}
              {childQuestions.map((child: any) => (
                child.content?.resolved_image_url && <img key={child.id} src={child.content.resolved_image_url} alt="" />
              ))}
            </div>
          );
        })}
      </div>

      <main className="flex-1 min-h-0 flex overflow-hidden bg-slate-50">
        <div className="flex-1 flex flex-col min-h-0 w-full px-6 py-4 text-slate-800 pb-12 lg:pb-0 overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-h-0 w-full flex flex-col">
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
