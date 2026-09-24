import type { ModuleTestType } from '@/lib/types';
import {
  filterSections,
  calculateBreakDuration,
  type ModuleMatchableSection,
} from '@/lib/constants';

/**
 * Pure, zero-division-protected metrics functions for exam scoring and display.
 */

/** Accuracy: correct / answered, as a rounded percentage. Returns 0 if no questions answered. */
export function calculateAccuracyPercentage(correctCount: number, answeredCount: number): number {
  if (answeredCount <= 0) return 0;
  return Math.round((correctCount / answeredCount) * 100);
}

/** Completion: answered / total, as a rounded percentage. Returns 0 if total is zero. */
export function calculateCompletionPercentage(answeredCount: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((answeredCount / maxScore) * 100);
}

export interface MetricSectionInput extends ModuleMatchableSection {
  id?: string;
  duration_seconds?: number | null;
  question_count?: number | null;
  sort_order?: number | null;
}

export interface ExamMetricsResult {
  sectionsCount: number;
  questionCount: number;
  durationMinutes: number;
}

/**
 * Calculates dynamically matched sections count, total question count,
 * and total duration (including realistic breaks) based on the user's
 * format and active module.
 */
export function calculateExamMetrics<T extends MetricSectionInput>(
  sections: T[] | undefined | null,
  isPaper: boolean,
  activeModule: ModuleTestType | string | null,
): ExamMetricsResult {
  if (!sections || sections.length === 0) {
    return {
      sectionsCount: 0,
      questionCount: isPaper ? 120 : 90,
      durationMinutes: isPaper ? 170 : 130,
    };
  }

  const { coreSections, moduleSections } = filterSections(sections, isPaper, activeModule);
  let eligibleSections = [...coreSections, ...moduleSections];
  if (eligibleSections.length === 0 && sections.length > 0) {
    eligibleSections = [...sections];
  }

  eligibleSections.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const sectionsCount = eligibleSections.length;
  const questionCount = eligibleSections.reduce(
    (sum, s) => sum + (s.question_count ?? 0),
    0
  );
  const totalSectionSeconds = eligibleSections.reduce(
    (sum, s) => sum + (s.duration_seconds ?? 1800),
    0
  );

  let totalBreakSeconds = 0;
  for (let i = 0; i < eligibleSections.length - 1; i++) {
    totalBreakSeconds += calculateBreakDuration(
      eligibleSections[i].question_type,
      eligibleSections[i + 1].question_type,
      isPaper
    );
  }

  const durationMinutes = sectionsCount > 0
    ? Math.round((totalSectionSeconds + totalBreakSeconds) / 60)
    : (isPaper ? 170 : 130);

  return {
    sectionsCount,
    questionCount: questionCount || (isPaper ? 120 : 90),
    durationMinutes,
  };
}
