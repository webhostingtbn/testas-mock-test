/**
 * Pure, zero-division-protected metrics functions for exam scoring.
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
