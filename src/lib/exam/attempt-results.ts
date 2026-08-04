import type { Json } from '@/lib/supabase/database.types';

export interface AttemptSectionAnswer {
  question_id: string;
  is_correct: boolean;
  is_answered: boolean;
}

export interface AttemptSectionScore {
  key: string;
  label: string;
  correct: number;
  total: number;
  answers: AttemptSectionAnswer[];
}

interface AnswerOutcome {
  questionId: string;
  isCorrect: boolean;
  isAnswered: boolean;
}

export interface SectionScoreReference {
  id: string;
  title: string;
  sort_order: number;
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractAnswerOutcomes(detailedResults: Json | null): AnswerOutcome[] {
  if (!detailedResults || !isRecord(detailedResults)) return [];

  const answers = detailedResults.answers;
  if (!Array.isArray(answers)) return [];

  return answers.flatMap((answer): AnswerOutcome[] => {
    if (!isRecord(answer)) return [];
    const questionId = answer.question_id;
    const isCorrect = answer.is_correct;
    if (typeof questionId !== 'string' || typeof isCorrect !== 'boolean') return [];
    const isAnswered = typeof answer.is_answered === 'boolean' ? answer.is_answered : true;
    return [{ questionId, isCorrect, isAnswered }];
  });
}

export function buildAttemptSectionScores(
  detailedResults: Json | null,
  questionSectionIds: ReadonlyMap<string, string>,
  sectionsById: ReadonlyMap<string, SectionScoreReference>,
): AttemptSectionScore[] {
  const scores = new Map<string, AttemptSectionScore>();

  for (const answer of extractAnswerOutcomes(detailedResults)) {
    const sectionId = questionSectionIds.get(answer.questionId);
    const section = sectionId ? sectionsById.get(sectionId) : undefined;
    if (!section) continue;

    const current = scores.get(section.id) ?? {
      key: section.id,
      label: section.title,
      correct: 0,
      total: 0,
      answers: [],
    };
    current.total += 1;
    if (answer.isAnswered && answer.isCorrect) current.correct += 1;
    current.answers.push({
      question_id: answer.questionId,
      is_correct: answer.isCorrect,
      is_answered: answer.isAnswered,
    });
    scores.set(section.id, current);
  }

  return [...scores.values()].sort((left, right) => {
    const leftSection = sectionsById.get(left.key);
    const rightSection = sectionsById.get(right.key);
    return (leftSection?.sort_order ?? 0) - (rightSection?.sort_order ?? 0);
  });
}
