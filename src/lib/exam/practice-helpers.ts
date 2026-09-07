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

/** Minimal question shape for passage grouping (compatible with ImageService input). */
export interface GroupablePracticeQuestion {
  id: string;
  section_id?: string;
  passage_id?: string | null;
  content?: unknown;
  questions?: GroupablePracticeQuestion[];
  [key: string]: unknown;
}

/** Minimal passage row shape for grouping. */
export interface PracticePassageLike {
  id: string;
  title: string;
  body_markdown: string;
  image_url?: string | null;
}

/** A session item: either a standalone question or one grouped passage. */
export interface GroupedPracticeItem extends GroupablePracticeQuestion {
  isPassage?: boolean;
  questions?: GroupablePracticeQuestion[];
}

/**
 * Groups passage children into one session item per passage (mirrors the
 * exam). Only the given items are included, so callers filter to the target
 * folder first and folder counts stay accurate. Items keep their original
 * encounter order: a passage group is emitted where its first child appears,
 * standalone questions pass through in place.
 */
export function groupPracticeItemsByPassage(
  items: GroupablePracticeQuestion[],
  passages: PracticePassageLike[],
): GroupedPracticeItem[] {
  const passageById = new Map(passages.map((p) => [p.id, p]));
  const childrenByPassage = new Map<string, GroupablePracticeQuestion[]>();
  for (const q of items) {
    if (q.passage_id) {
      const list = childrenByPassage.get(q.passage_id);
      if (list) list.push(q);
      else childrenByPassage.set(q.passage_id, [q]);
    }
  }

  const emittedPassages = new Set<string>();
  const result: GroupedPracticeItem[] = [];
  for (const q of items) {
    if (!q.passage_id) {
      result.push(q);
      continue;
    }
    if (emittedPassages.has(q.passage_id)) continue;
    emittedPassages.add(q.passage_id);
    const kids = childrenByPassage.get(q.passage_id) ?? [];
    const passage = passageById.get(q.passage_id);
    result.push({
      ...q,
      id: q.passage_id,
      section_id: kids[0]?.section_id ?? q.section_id,
      isPassage: true,
      title: passage?.title,
      body_markdown: passage?.body_markdown,
      image_url: passage?.image_url,
      questions: kids,
    });
  }
  return result;
}
