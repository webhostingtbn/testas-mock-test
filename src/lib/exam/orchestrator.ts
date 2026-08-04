/**
 * Exam Orchestrator
 *
 * Centralizes the exam flow logic (start, resume, finish) and coordinates
 * between the store and API endpoints.
 */

import { flattenExamAnswers, useExamStore, type StoredSection, type ExamFlowStep } from '@/lib/store/exam-store';
import {
  BREAK_DURATIONS,
  filterSections,
} from '@/lib/constants';
import type {
  ModuleTestType,
  Section,
} from '@/lib/types';

interface ExamQuestionRecord {
  id: string;
  section_id: string;
}

interface ExamPayload {
  sections: Section[];
  questions: ExamQuestionRecord[];
  exam?: {
    format?: string | null;
  };
}



function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSection(value: unknown): value is Section {
  if (!isRecord(value)) return false;
  const duration = Number(value.duration_seconds);
  const count = Number(value.question_count);
  const sort = Number(value.sort_order);

  return typeof value.id === 'string'
    && typeof value.exam_id === 'string'
    && typeof value.title === 'string'
    && typeof value.question_type === 'string'
    && !Number.isNaN(duration)
    && !Number.isNaN(count)
    && !Number.isNaN(sort);
}

function isQuestion(value: unknown): value is ExamQuestionRecord {
  return isRecord(value) && typeof value.id === 'string' && typeof value.section_id === 'string';
}

function parseExamPayload(value: unknown): ExamPayload {
  if (!isRecord(value)) throw new Error('Invalid exam response');
  const sections = Array.isArray(value.sections) ? value.sections.filter(isSection) : [];
  const questions = Array.isArray(value.questions) ? value.questions.filter(isQuestion) : [];
  if (sections.length === 0) throw new Error('Exam has no sections');
  return {
    sections,
    questions,
    exam: isRecord(value.exam)
      ? { format: typeof value.exam.format === 'string' ? value.exam.format : null }
      : undefined,
  };
}

function buildStoredSections(
  payload: ExamPayload,
  isPaper: boolean,
  activeModule: ModuleTestType | null,
): StoredSection[] {
  const { coreSections, moduleSections } = filterSections(payload.sections, isPaper, activeModule);
  let selectedSections = [...coreSections, ...moduleSections];
  if (selectedSections.length === 0 && payload.sections.length > 0) {
    selectedSections = payload.sections;
  }

  const questionIdsBySection = new Map<string, string[]>();

  payload.questions.forEach((question) => {
    const questionIds = questionIdsBySection.get(question.section_id) ?? [];
    questionIds.push(question.id);
    questionIdsBySection.set(question.section_id, questionIds);
  });

  return selectedSections
    .map((section) => {
      const questionIds = questionIdsBySection.get(section.id) ?? [];
      const questionCount = questionIds.length > 0
        ? questionIds.length
        : (section.question_count || 1);

      return {
        id: section.id,
        title: section.title,
        questionType: section.question_type,
        durationSeconds: section.duration_seconds || 1800,
        questionCount,
        questionIds,
      };
    })
    .filter((section) => section.questionCount > 0);
}

function isModuleQuestionType(questionType: string, isPaper: boolean): boolean {
  if (isPaper) {
    const paperModuleTypes = [
      'sc_1', 'sc_2',
      'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3',
      'econ_1', 'econ_2',
    ];
    return paperModuleTypes.includes(questionType);
  } else {
    const digitalModuleTypes = [
      'module_mcq',
      'interpreting_texts',
      'representation_systems',
      'linguistic_structures',
    ];
    return digitalModuleTypes.includes(questionType);
  }
}

function calculateBreakDuration(
  currentSection: StoredSection,
  nextSection: StoredSection,
  isPaper: boolean
): number {
  const currentIsModule = isModuleQuestionType(currentSection.questionType, isPaper);
  const nextIsModule = isModuleQuestionType(nextSection.questionType, isPaper);

  if (!currentIsModule && nextIsModule) {
    return BREAK_DURATIONS.LONG;
  }
  return BREAK_DURATIONS.SHORT;
}

function buildExamFlow(sections: StoredSection[], isPaper: boolean): ExamFlowStep[] {
  const flowSteps: ExamFlowStep[] = [];

  for (let i = 0; i < sections.length; i++) {
    flowSteps.push({ type: 'section' as const, sectionIndex: i });

    if (i < sections.length - 1) {
      const breakDuration = calculateBreakDuration(
        sections[i],
        sections[i + 1],
        isPaper
      );
      flowSteps.push({ type: 'break' as const, breakDuration });
    }
  }

  return flowSteps;
}

export async function startExam(
  examId: string,
  activeModule: ModuleTestType | null,
  format: 'Digital' | 'Paper'
): Promise<void> {
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    const attemptRes = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId }),
    });

    if (!attemptRes.ok) {
      const errJson = await attemptRes.json();
      throw new Error(errJson.error || 'Failed to create attempt session');
    }
    const { attempt } = await attemptRes.json();

    const examRes = await fetch(`/api/exams/${examId}`);
    if (!examRes.ok) throw new Error('Failed to fetch exam data');
    const examData = parseExamPayload(await examRes.json());

    const targetFormat = format || examData.exam?.format || 'Digital';
    const isPaper = typeof targetFormat === 'string' && targetFormat.toLowerCase() === 'paper';
    const builtSections = buildStoredSections(examData, isPaper, activeModule);
    if (builtSections.length === 0) throw new Error('Exam has no questions for the selected format/module');

    const flowSteps = buildExamFlow(builtSections, isPaper);

    storeStartExam({
      examId,
      userExamId: attempt.id,
      sections: builtSections,
      flowSteps,
    });
  } catch (err) {
    console.error('[ExamOrchestrator] Error starting exam:', err);
    throw err;
  }
}

export async function resumeExam(
  userExamId: string,
  activeModule: ModuleTestType | null
): Promise<void> {
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    const attemptRes = await fetch(`/api/attempts/${userExamId}`);
    if (!attemptRes.ok) throw new Error('Failed to load attempt session');
    const { attempt } = await attemptRes.json();

    const examRes = await fetch(`/api/exams/${attempt.exam_id}`);
    if (!examRes.ok) throw new Error('Failed to fetch exam data');
    const examData = parseExamPayload(await examRes.json());

    const targetFormat = examData.exam?.format || 'Digital';
    const isPaper = typeof targetFormat === 'string' && targetFormat.toLowerCase() === 'paper';
    const builtSections = buildStoredSections(examData, isPaper, activeModule);
    if (builtSections.length === 0) throw new Error('Exam has no questions for the selected format/module');

    const flowSteps = buildExamFlow(builtSections, isPaper);

    storeStartExam({
      examId: attempt.exam_id,
      userExamId,
      sections: builtSections,
      flowSteps,
    });
  } catch (err) {
    console.error('[ExamOrchestrator] Error resuming exam:', err);
    throw err;
  }
}

export async function finishExam(
  userExamId: string,
  userAnswers: Record<string, Record<string, unknown>>
): Promise<void> {
  const { resetExam } = useExamStore.getState();

  try {
    const res = await fetch(`/api/attempts/${userExamId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAnswers: flattenExamAnswers(userAnswers) }),
    });

    if (!res.ok) throw new Error('Failed to submit exam attempt');
    resetExam();
  } catch (err) {
    console.error('[ExamOrchestrator] Error finishing exam:', err);
    throw err;
  }
}

export function useExamOrchestrator() {
  async function handleStartExam(
    examId: string,
    activeModule: ModuleTestType | null,
    format: 'Digital' | 'Paper'
  ): Promise<void> {
    await startExam(examId, activeModule, format);
  }

  async function handleResumeExam(
    userExamId: string,
    activeModule: ModuleTestType | null,
  ): Promise<void> {
    await resumeExam(userExamId, activeModule);
  }

  async function handleFinishExam(
    userExamId: string,
    userAnswers: Record<string, Record<string, unknown>>
  ): Promise<void> {
    await finishExam(userExamId, userAnswers);
  }

  return {
    startExam: handleStartExam,
    resumeExam: handleResumeExam,
    finishExam: handleFinishExam,
  };
}
