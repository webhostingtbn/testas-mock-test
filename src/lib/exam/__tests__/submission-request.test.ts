import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseSubmissionRequest } from '../submission-request';

describe('parseSubmissionRequest', () => {
  it('defaults an omitted completion reason for legacy callers', () => {
    const result = parseSubmissionRequest({ userAnswers: { question: 'A' } });

    assert.deepStrictEqual(result, {
      ok: true,
      value: {
        userAnswers: { question: 'A' },
        completionReason: 'finished',
      },
    });
  });

  it('accepts an early completion reason', () => {
    const result = parseSubmissionRequest({
      userAnswers: { question: 'A' },
      completionReason: 'ended_early',
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.completionReason, 'ended_early');
  });

  it('rejects an explicitly invalid completion reason', () => {
    const result = parseSubmissionRequest({
      userAnswers: { question: 'A' },
      completionReason: 'ended-early',
    });

    assert.deepStrictEqual(result, {
      ok: false,
      error: 'completionReason must be finished or ended_early',
    });
  });

  it('rejects non-object answers', () => {
    const result = parseSubmissionRequest({
      userAnswers: null,
      completionReason: 'finished',
    });

    assert.deepStrictEqual(result, {
      ok: false,
      error: 'userAnswers must be a non-null object',
    });
  });
});
