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

export default function ExamPage() {
  const imageService = useMemo(() => new ImageService(), []);
  const router = useRouter();
  const { data: session } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const [sectionQuestions, setSectionQuestions] = useState<DisplayQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Rating persistence is optimistic: navigation gates on the LOCAL rating
  // only, while server sync runs in the background. Pending saves are
  // flushed (best-effort) when ending a subtest/test. Failures accumulate in
  // a keyed queue (one entry per question set) so nothing is ever stale.
  const [pendingRatingSaves, setPendingRatingSaves] = useState(0);
  // Every failed sync stays retryable, keyed by its own question ids — never
  // a stale single payload tied to whatever question is on screen.
  const [failedRatingSaves, setFailedRatingSaves] = useState<
    Array<{ questionIds: string[]; difficulty: 'easy' | 'medium' | 'hard' }>
  >([]);
  // Tracks in-flight rating syncs so end-of-section/test can flush them.
  const inFlightRatingSavesRef = useRef<Set<Promise<void>>>(new Set());

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

  // Navigation gates on the LOCAL rating only — server sync is backgrounded.
  const canNavigate = isCurrentQuestionRated;

  const failedKey = (questionIds: string[]): string => [...questionIds].sort().join('|');

  const syncRatingToServer = (questionIds: string[], difficulty: 'easy' | 'medium' | 'hard') => {
    setPendingRatingSaves((count) => count + 1);

    const savePromise = (async (): Promise<void> => {
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

        const key = failedKey(questionIds);
        if (results.every((res) => res.ok)) {
          // Success clears this payload's failure entry (if any).
          setFailedRatingSaves((queue) =>
            queue.filter((entry) => failedKey(entry.questionIds) !== key),
          );
        } else {
          setFailedRatingSaves((queue) =>
            queue.some((entry) => failedKey(entry.questionIds) === key)
              ? queue
              : [...queue, { questionIds, difficulty }],
          );
        }
      } catch (err) {
        console.error('Failed to sync difficulty rating to database:', err);
        const key = failedKey(questionIds);
        setFailedRatingSaves((queue) =>
          queue.some((entry) => failedKey(entry.questionIds) === key)
            ? queue
            : [...queue, { questionIds, difficulty }],
        );
      }
    })();

    inFlightRatingSavesRef.current.add(savePromise);
    void savePromise.finally(() => {
      inFlightRatingSavesRef.current.delete(savePromise);
      setPendingRatingSaves((count) => Math.max(0, count - 1));
    });
  };

  // Best-effort flush of background rating syncs before leaving a section or
  // finishing. Never blocks longer than the timeout — ratings are auxiliary
  // (Practice folders), not scoring.
  const flushRatingSaves = async (timeoutMs = 3000): Promise<void> => {
    const pending = [...inFlightRatingSavesRef.current];
    if (pending.length === 0) return;
    try {
      await Promise.race([
        Promise.allSettled(pending),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch {
      // Proceed regardless — failed syncs stay retryable via the banner.
    }
  };

  const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!currentQuestion) return;

    // Set rating in Zustand store immediately so navigation unlocks at once.
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

    // Persist to server in the background — do not await.
    syncRatingToServer(questionIdsToSync, difficulty);
  };

  const handleRetryRatingSave = () => {
    const queue = failedRatingSaves;
    setFailedRatingSaves([]);
    queue.forEach((entry) => syncRatingToServer(entry.questionIds, entry.difficulty));
  };

  // Banner text derives from the queue so navigation never shows a stale
  // single-question error.
  const ratingErrorMsg =
    failedRatingSaves.length === 0
      ? null
      : failedRatingSaves.length === 1
        ? '1 rating failed to sync'
        : `${failedRatingSaves.length} ratings failed to sync`;

  const handleTimeUp = () => {
    void flushRatingSaves(2000).finally(() => advanceFlowStep());
  };

  const handleEndSubtest = () => {
    void flushRatingSaves().finally(() => advanceFlowStep());
  };

  const handleEndTest = () => {
    void flushRatingSaves().finally(() => endExamEarly());
  };

  // Maps a loaded row (question or passage) to renderer input, preserving
  // nested passage children — dropping them makes ModuleMCQ render an empty
  // single-question fallback ("Questions (1)" with no text/options).
  const toQuestionData = (item: DisplayQuestion, index: number): QuestionData => ({
    id: item.id || `q-${index}`,
    sectionId: item.section_id || currentSection.id,
    sortOrder: item.sort_order || index + 1,
    questionType: item.question_type || currentSection.questionType,
    content: item.content ?? item,
    isPassage: item.isPassage,
    ...(Array.isArray(item.questions)
      ? { questions: item.questions.map((child, childIndex) => toQuestionData(child, childIndex)) }
      : {}),
  });

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

    return toQuestionData(currentQuestion, currentQuestionIndex);
  };

  const questionData = currentQuestion ? buildQuestionData() : null;
  const currentAnswer = questionData ? getAnswer(currentSection.id, questionData.id) : null;

  // Per-child answers for grouped (passage) questions, keyed by child id —
  // this is what ModuleMCQ reads and what scoring looks up. Undefined (not
  // `{}`) when nothing is answered so the renderer keeps its own fallback.
  const passageChildAnswers = (() => {
    if (!currentQuestion?.isPassage || !currentQuestion.questions) return undefined;
    const entries: Array<[string, string]> = [];
    for (const child of currentQuestion.questions) {
      const childAnswer = getAnswer(currentSection.id, child.id);
      if (typeof childAnswer === 'string') entries.push([child.id, childAnswer]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  })();

  const handleAnswerChange = (value: unknown, questionId?: string) => {
    if (questionData) {
      setAnswer(currentSection.id, questionId ?? questionData.id, value);
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
          <div className="w-full space-y-6">
            {isLoadingQuestions ? (
              <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : questionData ? (
              <div key={questionData.id} className="w-full">
              {questionRendererFactory.render(questionData, {
                selectedAnswer: currentAnswer,
                selectedAnswers: passageChildAnswers,
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
          isRatingSaving={pendingRatingSaves > 0}
          ratingError={ratingErrorMsg}
          onRetryRatingSave={handleRetryRatingSave}
          currentRating={currentRating}
          onRatingChange={(rating) => handleDifficultySelect(rating)}
        />
      </div>
    </>
  );
}
