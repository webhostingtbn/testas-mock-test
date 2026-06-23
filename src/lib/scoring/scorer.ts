import type { Section, Question } from '@/lib/types';
import type { StoredSection } from '@/lib/store/exam-store';
import type { SectionResult, GlobalStats, DetailedAnswer, DetailedResultsBySection, SectionType } from './types';
import { isNumericalSeriesCorrect } from './numerical-series';

// Type alias to accept both DB Section and stored Section
type SectionLike = Section | StoredSection;

// Type alias for SectionResult to match stored format
type SectionResultLike = SectionResult;

// =============================================================
// Answer comparison utilities
// =============================================================

/**
 * Deep equality check for answer comparison.
 * Handles FigureSequence format where answer is { image1, image2 }
 */
export function isDeepEqual(a: any, b: any): boolean {
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const keys1 = Object.keys(a);
    const keys2 = Object.keys(b);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }
  return a === b;
}

/**
 * Format answer for comparison:
 * - FigureSequence: { image1, image2 } -> [image1, image2]
 * - MathEquation: { A, B } -> [A, B]
 * - Others: return value or null if undefined
 */
export function formatAnsForComparison(a: any): any {
  if (a && typeof a === 'object') {
    if ('image1' in a && 'image2' in a) return [a.image1, a.image2];
    if ('A' in a && 'B' in a) return [a.A, a.B];
  }
  return a !== undefined ? a : null;
}

/**
 * Check if an answer is correct, handling question type specific logic.
 */
export function isAnswerCorrect(userAns: any, correctAns: any, type: string): boolean {
  if (userAns === null || userAns === undefined || correctAns === undefined) {
    return false;
  }

  if (type === 'numerical_series') {
    return isNumericalSeriesCorrect(String(userAns), String(correctAns));
  }

  return isDeepEqual(formatAnsForComparison(userAns), formatAnsForComparison(correctAns));
}

// =============================================================
// Core calculation functions
// =============================================================

/**
 * Process results section by section, calculating correct/answered counts and percentages.
 */
export function calculateSectionResults(
  sections: SectionLike[],
  answers: Record<string, Record<string, unknown>>,
  questionsData: Question[]
): SectionResult[] {
  // Build map of correct answers and types by question ID
  const questionsMap = questionsData.reduce(
    (acc: Record<string, { correct: any; type: string }>, q) => {
      acc[q.id] = { correct: q.correct_answer, type: q.question_type };
      return acc;
    },
    {}
  );

  return sections.map((section) => {
    const sectionAnswers = answers[section.id] || {};
    let correctCount = 0;
    let answeredCount = 0;

    // Get actual questions in this section
    const actualQuestionIds = questionsData
      .filter((q) => q.section_id === section.id)
      .map((q) => q.id);

    const actualTotalQuestions = actualQuestionIds.length;

    // Check each real question in the section
    actualQuestionIds.forEach((qId) => {
      const ans = sectionAnswers[qId];
      const qInfo = questionsMap[qId];
      const correctAns = qInfo?.correct;
      const qType = qInfo?.type;

      if (ans !== null && ans !== undefined) {
        answeredCount++;
      }

      if (
        ans !== null &&
        ans !== undefined &&
        correctAns !== undefined
      ) {
        if (isAnswerCorrect(ans, correctAns, qType || '')) {
          correctCount++;
        }
      }
    });

    const percentage =
      actualTotalQuestions > 0
        ? Math.round((correctCount / actualTotalQuestions) * 100)
        : 0;

    // Determine question type based on available properties
    const sectionType = 'questionType' in section
      ? section.questionType
      : section.question_type;

    return {
      id: section.id,
      title: section.title,
      type: sectionType,
      totalQuestions: actualTotalQuestions,
      actualQuestionIds,
      answeredCount,
      correctCount,
      percentage,
    };
  });
}

/**
 * Aggregate global stats from section results.
 */
export function aggregateGlobalStats(results: SectionResult[]): GlobalStats {
  const totalCorrect = results.reduce((sum, s) => sum + s.correctCount, 0);
  const totalQuestions = results.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalAnswered = results.reduce((sum, s) => sum + s.answeredCount, 0);
  const overallPercentage =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return {
    totalCorrect,
    totalQuestions,
    totalAnswered,
    overallPercentage,
  };
}

/**
 * Build detailed results structure for DB persistence.
 */
export function buildDetailedResults(
  sectionResults: SectionResult[],
  answers: Record<string, Record<string, unknown>>,
  questionsData: Question[]
): DetailedResultsBySection {
  const questionsMap = questionsData.reduce(
    (acc: Record<string, { correct: any; type: string }>, q) => {
      acc[q.id] = { correct: q.correct_answer, type: q.question_type };
      return acc;
    },
    {}
  );

  return sectionResults.reduce((acc, result) => {
    const sectionAnswers = answers[result.id] || {};

    const formattedAnswers: DetailedAnswer[] = result.actualQuestionIds.map((qId) => {
      const ans = sectionAnswers[qId];
      const qInfo = questionsMap[qId];
      const correctAns = qInfo?.correct;
      const qType = qInfo?.type;
      const formattedUserAns = formatAnsForComparison(ans);
      const formattedCorrectAns = formatAnsForComparison(correctAns);

      const isCorrect = isAnswerCorrect(ans, correctAns, qType || '');

      return {
        question_id: qId,
        user_answer: formattedUserAns,
        correct_answer: formattedCorrectAns,
        is_correct: isCorrect,
      };
    });

    acc[result.title] = {
      score: result.correctCount,
      max_score: result.totalQuestions,
      type: result.type,
      answers: formattedAnswers,
    };

    return acc;
  }, {} as DetailedResultsBySection);
}

/**
 * Get list of incorrect or unanswered question IDs from section results.
 * Used for auto-assigning 'hard' difficulty in practice tracking.
 */
export function getIncorrectOrUnansweredQuestionIds(
  sectionResults: SectionResultLike[],
  answers: Record<string, Record<string, unknown>>,
  questionsData: Question[]
): string[] {
  const questionsMap = questionsData.reduce(
    (acc: Record<string, { correct: any; type: string }>, q) => {
      acc[q.id] = { correct: q.correct_answer, type: q.question_type };
      return acc;
    },
    {}
  );

  const incorrectIds: string[] = [];

  sectionResults.forEach((result) => {
    const sectionAnswers = answers[result.id] || {};
    result.actualQuestionIds.forEach((qId) => {
      const ans = sectionAnswers[qId];
      const qInfo = questionsMap[qId];
      const correctAns = qInfo?.correct;

      // Question is incorrect if:
      // 1. Answer is null/undefined (unanswered), OR
      // 2. Answer is provided but is wrong
      if (ans === null || ans === undefined) {
        incorrectIds.push(qId); // Unanswered
      } else if (correctAns !== undefined) {
        if (!isAnswerCorrect(ans, correctAns, qInfo.type || '')) {
          incorrectIds.push(qId); // Wrong answer
        }
      }
    });
  });

  return incorrectIds;
}
