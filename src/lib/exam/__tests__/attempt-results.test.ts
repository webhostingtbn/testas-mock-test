import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildAttemptSectionScores } from '../attempt-results';

describe('buildAttemptSectionScores', () => {
  it('preserves answered state when grouping outcomes by section', () => {
    const scores = buildAttemptSectionScores(
      {
        answers: [
          { question_id: 'q1', is_correct: true, is_answered: true },
          { question_id: 'q2', is_correct: false, is_answered: false },
        ],
      },
      new Map([
        ['q1', 'section-1'],
        ['q2', 'section-1'],
      ]),
      new Map([
        ['section-1', { id: 'section-1', title: 'Patterns', sort_order: 1 }],
      ]),
    );

    assert.deepStrictEqual(scores, [
      {
        key: 'section-1',
        label: 'Patterns',
        correct: 1,
        total: 2,
        answers: [
          { question_id: 'q1', is_correct: true, is_answered: true },
          { question_id: 'q2', is_correct: false, is_answered: false },
        ],
      },
    ]);
  });
});
