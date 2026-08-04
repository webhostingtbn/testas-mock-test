/**
 * Pure helper functions for Practice filtering logic.
 * Extracted here so they can be unit-tested without any store/React dependency.
 */

type DifficultyRating = 'easy' | 'medium' | 'hard';

/**
 * Filters questions to only those whose rating in `userRatings` matches `folder`.
 * Unrated questions are excluded from all folders.
 */
export function filterPracticeQuestionsByRating<T extends { id: string }>(
  questions: T[],
  userRatings: Record<string, DifficultyRating>,
  folder: DifficultyRating,
): T[] {
  return questions.filter((q) => userRatings[q.id] === folder);
}

/**
 * Returns the IDs of all child questions within a passage-type question.
 * Returns an empty array for non-passage questions.
 */
export function getPassageChildQuestionIds(
  passageQuestion: { isPassage?: boolean; questions?: Array<{ id: string }> },
): string[] {
  if (passageQuestion.isPassage && Array.isArray(passageQuestion.questions)) {
    return passageQuestion.questions.map((q) => q.id);
  }
  return [];
}
