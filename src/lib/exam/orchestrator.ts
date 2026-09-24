/**
 * Exam Orchestrator
 *
 * Centralizes the exam flow logic (start, resume, finish) and coordinates
 * between the store and API endpoints.
 */

import { flattenExamAnswers, useExamStore, type StoredSection, type ExamFlowStep } from '@/lib/store/exam-store';
import {
  BREAK_DURATIONS,
  calculateBreakDuration,
  filterSections,
} from '@/lib/constants';
import type {
  ModuleTestType,
  Section,
} from '@/lib/types';

export interface ExamQuestionRecord {
  id: string;
  section_id: string;
}

export interface ExamPayload {
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

export function buildStoredSections(
  payload: ExamPayload,
  isPaper: boolean,
  activeModule: ModuleTestType | null,
  allowedSectionIds?: string[] | null,
): StoredSection[] {
  const { coreSections, moduleSections } = filterSections(payload.sections, isPaper, activeModule);
  let eligibleSections = [...coreSections, ...moduleSections];
  if (eligibleSections.length === 0 && payload.sections.length > 0) {
    eligibleSections = payload.sections;
  }

  let selectedSections: Section[];
  if (allowedSectionIds && allowedSectionIds.length > 0) {
    selectedSections = eligibleSections.filter((section) => allowedSectionIds.includes(section.id));
  } else {
    selectedSections = eligibleSections;
  }

  // Preserve original database sort_order
  selectedSections.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

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

export function buildExamFlow(sections: StoredSection[], isPaper: boolean): ExamFlowStep[] {
  const flowSteps: ExamFlowStep[] = [];

  for (let i = 0; i < sections.length; i++) {
    flowSteps.push({ type: 'section' as const, sectionIndex: i });

    if (i < sections.length - 1) {
      const breakDuration = calculateBreakDuration(
        sections[i].questionType,
        sections[i + 1].questionType,
        isPaper
      );
      flowSteps.push({ type: 'break' as const, breakDuration });
    }
  }

  return flowSteps;
}

/**
 * Throws when the exam's own format disagrees with the format the caller
 * expects (e.g. resuming a Paper attempt while the profile is Digital).
 * Without this, the exam screen silently renders the wrong format's sections.
 */
function assertExamFormat(
  examFormat: string | null | undefined,
  expectedFormat: string | null | undefined,
  action: 'start' | 'resume',
): void {
  if (!examFormat || !expectedFormat) return;
  if (examFormat.toLowerCase() !== expectedFormat.toLowerCase()) {
    throw new Error(
      `Cannot ${action} this attempt: it belongs to a ${examFormat} test, but your profile is set to ${expectedFormat}. Switch format to ${action} it.`,
    );
  }
}

export async function startExam(
  examId: string,
  activeModule: ModuleTestType | null,
  format: 'Digital' | 'Paper',
  sectionIds?: string[] | null,
  attemptKind: 'mock' | 'drill' = 'mock',
): Promise<void> {
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    const attemptRes = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId,
        sectionIds: sectionIds && sectionIds.length > 0 ? sectionIds : undefined,
        attemptKind,
      }),
    });

    if (!attemptRes.ok) {
      const errJson = await attemptRes.json();
      throw new Error(errJson.error || 'Failed to create attempt session');
    }
    const { attempt } = await attemptRes.json();

    const examRes = await fetch(`/api/exams/${examId}`);
    if (!examRes.ok) throw new Error('Failed to fetch exam data');
    const examData = parseExamPayload(await examRes.json());
    assertExamFormat(examData.exam?.format, format, 'start');

    const targetFormat = format || examData.exam?.format || 'Digital';
    const isPaper = typeof targetFormat === 'string' && targetFormat.toLowerCase() === 'paper';
    const builtSections = buildStoredSections(examData, isPaper, activeModule, sectionIds);
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
  activeModule: ModuleTestType | null,
  format: 'Digital' | 'Paper' | null
): Promise<void> {
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    const attemptRes = await fetch(`/api/attempts/${userExamId}`);
    if (!attemptRes.ok) {
      const detail = await attemptRes.json().catch(() => null);
      const serverError =
        detail && typeof detail === 'object' && 'error' in detail && typeof detail.error === 'string'
          ? detail.error
          : null;
      throw new Error(
        `Failed to load attempt session (HTTP ${attemptRes.status}${serverError ? `: ${serverError}` : ''})`,
      );
    }
    const { attempt } = await attemptRes.json();

    const examRes = await fetch(`/api/exams/${attempt.exam_id}`);
    if (!examRes.ok) throw new Error('Failed to fetch exam data');
    const examData = parseExamPayload(await examRes.json());
    assertExamFormat(examData.exam?.format, format, 'resume');

    const targetFormat = format || examData.exam?.format || 'Digital';
    const isPaper = typeof targetFormat === 'string' && targetFormat.toLowerCase() === 'paper';
    const allowedSectionIds = Array.isArray(attempt.section_ids) && attempt.section_ids.length > 0
      ? attempt.section_ids
      : null;
    const builtSections = buildStoredSections(examData, isPaper, activeModule, allowedSectionIds);
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
    format: 'Digital' | 'Paper',
    sectionIds?: string[] | null,
    attemptKind: 'mock' | 'drill' = 'mock',
  ): Promise<void> {
    await startExam(examId, activeModule, format, sectionIds, attemptKind);
  }

  async function handleResumeExam(
    userExamId: string,
    activeModule: ModuleTestType | null,
    format: 'Digital' | 'Paper' | null,
  ): Promise<void> {
    await resumeExam(userExamId, activeModule, format);
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
