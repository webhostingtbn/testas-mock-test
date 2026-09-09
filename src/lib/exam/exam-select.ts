/**
 * Default exam selection shared by the dashboard hook and the mock view.
 *
 * Priority: exact profile-format match first; when no format is chosen yet,
 * prefer Digital (the app-wide default everywhere else); otherwise the
 * first exam. Never returns a Paper exam by raw API order when a Digital
 * one is available.
 */

interface ExamLike {
  id: string;
  format?: string | null;
}

function normalizedFormat(exam: ExamLike): string {
  return (exam.format || '').toLowerCase();
}

export function pickDefaultExam<T extends ExamLike>(
  exams: T[],
  format: string | null | undefined,
): T | null {
  if (exams.length === 0) return null;

  if (format) {
    const match = exams.find((exam) => normalizedFormat(exam) === format.toLowerCase());
    if (match) return match;
  } else {
    const digital = exams.find((exam) => normalizedFormat(exam) === 'digital');
    if (digital) return digital;
  }

  return exams[0];
}
