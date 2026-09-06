'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

interface DisplayQuestion {
  id: string;
  section_id?: string;
  sort_order?: number;
  question_type?: string;
  content?: unknown;
  isPassage?: boolean;
  questions?: DisplayQuestion[];
  passage_id?: string;
}

type RatingSaveState = 'idle' | 'saving' | 'error';

export default function ExamPage() {
  const imageService = useMemo(() => new ImageService(), []);
  const router = useRouter();
  const { data: session } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const [sectionQuestions, setSectionQuestions] = useState<DisplayQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Rating persistence state — keyed to the question being rated.
  // saveVersion serializes writes: only the latest version's completion is accepted.
  const [ratingSaveState, setRatingSaveState] = useState<RatingSaveState>('idle');
  const [ratingErrorMsg, setRatingErrorMsg] = useState<string | null>(null);
  const [lastRatingPayload, setLastRatingPayload] = useState<{
    questionIds: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    forQuestionIndex: number;
    forSectionIndex: number;
  } | null>(null);
  const saveVersionRef = useRef(0);

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
    endExamEarly,
  } = useExamStore();

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
            return;
          }
        }
        setUserProfile({
          email: email,
          fullName: session?.user?.name || null,
        });
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
      const displayQuestions: DisplayQuestion[] = isModuleSection
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
  }, [currentExamId, imageService]);

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

  // Reset rating save state when question changes — but preserve error+retry if pending.
  useEffect(() => {
    if (ratingSaveState !== 'error') {
      setRatingSaveState('idle');
      setRatingErrorMsg(null);
      // Don't clear lastRatingPayload — it's keyed to a specific question and still valid.
    }
  }, [currentQuestionIndex, currentSectionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const currentQuestion: DisplayQuestion | null = sectionQuestions[currentQuestionIndex] || null;

  // Derive whether current question (or all passage children) is rated
  const isCurrentQuestionRated = (() => {
    if (!currentQuestion) return false;
    if (currentQuestion.isPassage && currentQuestion.questions) {
      return currentQuestion.questions.every(
        (childQ) => getRating(currentSection.id, childQ.id) !== null,
      );
    }
    return getRating(currentSection.id, currentQuestion.id) !== null;
  })();

  // Show End Test on non-final subtests
  const showEndTest = currentSectionIndex < sections.length - 1;

  // Combined navigation gate: rated + save not in-flight or failed
  const canNavigate = isCurrentQuestionRated && ratingSaveState === 'idle';

  const syncRatingToServer = async (questionIds: string[], difficulty: 'easy' | 'medium' | 'hard') => {
    saveVersionRef.current += 1;
    const thisVersion = saveVersionRef.current;

    setRatingSaveState('saving');
    setRatingErrorMsg(null);
    setLastRatingPayload({
      questionIds,
      difficulty,
      forQuestionIndex: currentQuestionIndex,
      forSectionIndex: currentSectionIndex,
    });

    try {
      const results = await Promise.all(
        questionIds.map((qId) =>
          fetch(`/api/practice/${qId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty }),
          }),
        ),
      );

      // Stale: a newer write has started; ignore this completion.
      if (thisVersion !== saveVersionRef.current) return;

      const failedResults = results.filter((res) => !res.ok);
      if (failedResults.length > 0) {
        setRatingSaveState('error');
        setRatingErrorMsg(`${failedResults.length} of ${results.length} rating(s) failed to sync`);
        return;
      }

      setRatingSaveState('idle');
      setRatingErrorMsg(null);
      setLastRatingPayload(null);
    } catch (err) {
      // Stale: a newer write has started; ignore this completion.
      if (thisVersion !== saveVersionRef.current) return;
      console.error('Failed to sync difficulty rating to database:', err);
      setRatingSaveState('error');
      setRatingErrorMsg('Network error syncing rating');
    }
  };

  const handleDifficultySelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!currentQuestion) return;

    // Set rating in Zustand store immediately
    const questionIdsToSync: string[] = [];
    if (currentQuestion.isPassage && currentQuestion.questions) {
      currentQuestion.questions.forEach((childQ) => {
        setRating(currentSection.id, childQ.id, difficulty);
        questionIdsToSync.push(childQ.id);
      });
    } else {
      setRating(currentSection.id, currentQuestion.id, difficulty);
      questionIdsToSync.push(currentQuestion.id);
    }

    // Persist to server
    await syncRatingToServer(questionIdsToSync, difficulty);
  };

  const handleRetryRatingSave = async () => {
    if (lastRatingPayload) {
      await syncRatingToServer(lastRatingPayload.questionIds, lastRatingPayload.difficulty);
    }
  };

  const handleTimeUp = () => {
    advanceFlowStep();
  };

  const handleEndSubtest = () => {
    advanceFlowStep();
  };

  const handleEndTest = () => {
    endExamEarly();
  };

  const buildQuestionData = (): QuestionData => {
    if (!currentQuestion) {
      return {
        id: `q-${currentQuestionIndex}`,
        sectionId: currentSection.id,
        sortOrder: currentQuestionIndex + 1,
        questionType: currentSection.questionType,
        content: {},
      };
    }

    return {
      id: currentQuestion.id || `q-${currentQuestionIndex}`,
      sectionId: currentQuestion.section_id || currentSection.id,
      sortOrder: currentQuestion.sort_order || currentQuestionIndex + 1,
      questionType: currentQuestion.question_type || currentSection.questionType,
      content: currentQuestion.content || currentQuestion,
    };
  };

  const questionData = currentQuestion ? buildQuestionData() : null;
  const currentAnswer = questionData ? getAnswer(currentSection.id, questionData.id) : null;

  const handleAnswerChange = (value: unknown) => {
    if (questionData) {
      setAnswer(currentSection.id, questionData.id, value);
    }
  };

  // For passage questions, derive the displayed rating from the first child's rating
  // (all children get the same rating via handleDifficultySelect)
  const currentRating = (() => {
    if (!currentQuestion) return null;
    if (currentQuestion.isPassage && currentQuestion.questions && currentQuestion.questions.length > 0) {
      return getRating(currentSection.id, currentQuestion.questions[0].id);
    }
    return getRating(currentSection.id, currentQuestion.id);
  })();

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
          isCurrentQuestionRated={canNavigate}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            {isLoadingQuestions ? (
              <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : questionData ? (
              <div key={questionData.id} className="w-full">
              {questionRendererFactory.render(questionData, {
                selectedAnswer: currentAnswer,
                onAnswer: handleAnswerChange,
              })}
              </div>
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
          onEndTest={handleEndTest}
          showEndTest={showEndTest}
          isFirstQuestion={currentQuestionIndex === 0}
          isLastQuestion={currentQuestionIndex === totalQuestions - 1}
          sectionTitle={currentSection.title}
          isCurrentQuestionRated={canNavigate}
          isRatingSaving={ratingSaveState === 'saving'}
          ratingError={ratingErrorMsg}
          onRetryRatingSave={handleRetryRatingSave}
          currentRating={currentRating}
          onRatingChange={(rating) => handleDifficultySelect(rating)}
        />
      </div>
    </>
  );
}
