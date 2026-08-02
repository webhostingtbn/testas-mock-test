'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useExamStore } from '@/lib/store/exam-store';
import ExamTopBar from '@/components/exam/ExamTopBar';
import ExamBottomBar from '@/components/exam/ExamBottomBar';
import BreakScreen from '@/components/exam/BreakScreen';
import { getMockQuestions } from '@/lib/mock-data';
import SecurityOverlay from '@/components/exam/SecurityOverlay';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import { questionRendererFactory, QuestionData } from '@/lib/exam/renderer';
import { ImageService } from '@/lib/services/image-service';

export default function ExamPage() {
  const imageService = useMemo(() => new ImageService(), []);
  const router = useRouter();
  const { data: session } = useSession();
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
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setUserProfile({
              email: data.profile.email,
              fullName: data.profile.full_name,
            });
            setUserId(data.profile.id);
            return;
          }
        }
        setUserProfile({
          email: email,
          fullName: session?.user?.name || null,
        });
        if (session?.user?.id) setUserId(session.user.id);
      } catch (err) {
        console.error('Failed to fetch user profile for watermark:', err);
        setUserProfile({
          email: email,
          fullName: session?.user?.name || null,
        });
      }
    }

    fetchProfile();
  }, [session]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push('/dashboard');
    }
  }, [hydrated, currentExamId, router]);

  const fetchQuestionsForSection = useCallback(async (section: typeof sections[0]) => {
    setIsLoadingQuestions(true);
    try {
      const res = await fetch(`/api/exams/${currentExamId}`);
      if (!res.ok) throw new Error('Failed to load questions from server API');
      const examData = await res.json();
      const rawQuestions = (examData.questions || []).filter(
        (question: { section_id?: string }) => question.section_id === section.id,
      );

      const isModuleSection = [
        'module_mcq',
        'interpreting_texts',
        'representation_systems',
        'linguistic_structures',
      ].includes(section.questionType);
      const sectionPassages = (examData.passages || []).filter(
        (passage: { section_id?: string }) => passage.section_id === section.id,
      );
      const displayQuestions = isModuleSection
        ? [
            ...sectionPassages
              .map((passage: { id: string; section_id?: string }) => ({
                ...passage,
                isPassage: true,
                questions: rawQuestions.filter(
                  (question: { passage_id?: string }) => question.passage_id === passage.id,
                ),
              }))
              .filter((passage: { questions: unknown[] }) => passage.questions.length > 0),
            ...rawQuestions.filter((question: { passage_id?: string }) => !question.passage_id),
          ]
        : rawQuestions;

      const resolved = await imageService.resolveQuestionImageUrls(displayQuestions);
      setSectionQuestions(resolved);
    } catch (err) {
      console.error('Failed to load questions:', err);
      setSectionQuestions(getMockQuestions(section.questionType, section.questionCount));
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [currentExamId]);

  useEffect(() => {
    if (!hydrated || !currentExamId) return;
    const section = sections[currentSectionIndex];
    if (section) {
      fetchQuestionsForSection(section);
    }
  }, [hydrated, currentExamId, currentSectionIndex, sections, fetchQuestionsForSection]);

  useEffect(() => {
    if (!hydrated || flowSteps.length === 0) return;
    if (currentFlowStepIndex >= flowSteps.length) {
      router.push('/results');
    }
  }, [hydrated, currentFlowStepIndex, flowSteps.length, router]);

  const currentStep = flowSteps[currentFlowStepIndex];

  useEffect(() => {
    if (!hydrated || !currentStep) return;

    if (currentStep.type === 'section' && currentStep.sectionIndex !== undefined) {
      startSection(currentStep.sectionIndex);
    } else if (currentStep.type === 'break' && currentStep.breakDuration !== undefined) {
      startBreak(currentStep.breakDuration);
    }
  }, [hydrated, currentStep, startSection, startBreak]);

  if (!hydrated || !currentExamId || !currentStep) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (currentStep.type === 'break') {
    return (
      <BreakScreen
        onSkip={() => advanceFlowStep()}
        onComplete={() => advanceFlowStep()}
      />
    );
  }

  const currentSection = sections[currentSectionIndex];
  if (!currentSection) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>Section not found</p>
      </div>
    );
  }

  const totalQuestions = sectionQuestions.length > 0
    ? sectionQuestions.length
    : currentSection.questionCount;

  const currentQuestion = sectionQuestions[currentQuestionIndex] || null;

  const handleDifficultySelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!currentQuestion) return;

    if (currentQuestion.isPassage && currentQuestion.questions) {
      currentQuestion.questions.forEach((childQ: any) => {
        setRating(currentSection.id, childQ.id, difficulty);
      });
    } else {
      setRating(currentSection.id, currentQuestion.id, difficulty);
    }
    
    if (userId) {
      try {
        const questionIdsToSync = currentQuestion.isPassage && currentQuestion.questions
          ? currentQuestion.questions.map((childQ: any) => childQ.id)
          : [currentQuestion.id];

        for (const qId of questionIdsToSync) {
          await fetch(`/api/practice/${qId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty }),
          });
        }
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

  const buildQuestionData = (): QuestionData => {
    const q = currentQuestion || {};
    return {
      id: q.id || `q-${currentQuestionIndex}`,
      sectionId: q.section_id || currentSection.id,
      sortOrder: q.sort_order || currentQuestionIndex + 1,
      questionType: q.question_type || currentSection.questionType,
      content: q.content || q,
    };
  };

  const questionData = currentQuestion ? buildQuestionData() : null;
  const currentAnswer = questionData ? getAnswer(currentSection.id, questionData.id) : null;

  const handleAnswerChange = (value: unknown) => {
    if (questionData) {
      setAnswer(currentSection.id, questionData.id, value);
    }
  };

  const currentRating = currentQuestion ? getRating(currentSection.id, currentQuestion.id) : null;

  const answeredIndices = Object.keys(answers[currentSection.id] || {}).map((_, idx) => idx);

  return (
    <>
      <SecurityOverlay />
      <WatermarkOverlay email={userProfile?.email || session?.user?.email || ''} fullName={userProfile?.fullName || session?.user?.name || null} />
      <div className="flex flex-col h-screen bg-background text-foreground select-none">
        <ExamTopBar
          sectionTitle={currentSection.title}
          totalQuestions={totalQuestions}
          currentQuestionIndex={currentQuestionIndex}
          answeredQuestions={answeredIndices}
          onQuestionClick={(idx) => goToQuestion(idx)}
          onTimeUp={handleTimeUp}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            {isLoadingQuestions ? (
              <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : questionData ? (
              questionRendererFactory.render(questionData, {
                selectedAnswer: currentAnswer,
                onAnswer: handleAnswerChange,
              })
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                Question type &quot;{currentSection.questionType}&quot; coming soon.
              </div>
            )}
          </div>
        </main>

        <ExamBottomBar
          onBack={prevQuestion}
          onNext={nextQuestion}
          onEndSubtest={handleEndSubtest}
          isFirstQuestion={currentQuestionIndex === 0}
          isLastQuestion={currentQuestionIndex === totalQuestions - 1}
          sectionTitle={currentSection.title}
          currentRating={currentRating}
          onRatingChange={(rating) => handleDifficultySelect(rating)}
        />
      </div>
    </>
  );
}
