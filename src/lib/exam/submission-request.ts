import type { CompletionReason } from '@/lib/types';

export interface SubmissionRequest {
  userAnswers: Record<string, unknown>;
  completionReason: CompletionReason;
}

export type SubmissionRequestResult =
  | { ok: true; value: SubmissionRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompletionReason(value: unknown): value is CompletionReason {
  return value === 'finished' || value === 'ended_early';
}

export function parseSubmissionRequest(value: unknown): SubmissionRequestResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  if (!isRecord(value.userAnswers)) {
    return { ok: false, error: 'userAnswers must be a non-null object' };
  }

  if (value.completionReason !== undefined && !isCompletionReason(value.completionReason)) {
    return { ok: false, error: 'completionReason must be finished or ended_early' };
  }

  return {
    ok: true,
    value: {
      userAnswers: value.userAnswers,
      completionReason: value.completionReason ?? 'finished',
    },
  };
}
