import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterPracticeQuestionsByRating,
  getPassageChildQuestionIds,
} from '../practice-helpers';
import {
  calculateAccuracyPercentage,
  calculateCompletionPercentage,
} from '../metrics';

// ---- filterPracticeQuestionsByRating ----

describe('filterPracticeQuestionsByRating', () => {
  const questions = [
    { id: 'q1', text: 'Question 1' },
    { id: 'q2', text: 'Question 2' },
    { id: 'q3', text: 'Question 3' },
    { id: 'q4', text: 'Question 4' },
  ];

  const ratings: Record<string, 'easy' | 'medium' | 'hard'> = {
    q1: 'easy',
    q2: 'hard',
    q3: 'easy',
    // q4 is unrated
  };

  it('returns questions matching the requested folder', () => {
    const result = filterPracticeQuestionsByRating(questions, ratings, 'easy');
    assert.deepStrictEqual(
      result.map((q) => q.id),
      ['q1', 'q3'],
    );
  });

  it('returns empty array for folder with no matches', () => {
    const result = filterPracticeQuestionsByRating(questions, ratings, 'medium');
    assert.deepStrictEqual(result, []);
  });

  it('excludes unrated questions from every folder', () => {
    const easyResult = filterPracticeQuestionsByRating(questions, ratings, 'easy');
    const mediumResult = filterPracticeQuestionsByRating(questions, ratings, 'medium');
    const hardResult = filterPracticeQuestionsByRating(questions, ratings, 'hard');

    const allIds = [
      ...easyResult.map((q) => q.id),
      ...mediumResult.map((q) => q.id),
      ...hardResult.map((q) => q.id),
    ];
    assert.ok(!allIds.includes('q4'), 'Unrated question q4 should not appear in any folder');
  });

  it('handles empty questions array', () => {
    const result = filterPracticeQuestionsByRating([], ratings, 'easy');
    assert.deepStrictEqual(result, []);
  });

  it('handles empty ratings', () => {
    const result = filterPracticeQuestionsByRating(questions, {}, 'easy');
    assert.deepStrictEqual(result, []);
  });
});

// ---- getPassageChildQuestionIds ----

describe('getPassageChildQuestionIds', () => {
  it('returns child IDs for a passage question', () => {
    const passage = {
      isPassage: true,
      questions: [{ id: 'child1' }, { id: 'child2' }, { id: 'child3' }],
    };
    const ids = getPassageChildQuestionIds(passage);
    assert.deepStrictEqual(ids, ['child1', 'child2', 'child3']);
  });

  it('returns empty array for non-passage question', () => {
    const question = { isPassage: false };
    assert.deepStrictEqual(getPassageChildQuestionIds(question), []);
  });

  it('returns empty array when isPassage is undefined', () => {
    assert.deepStrictEqual(getPassageChildQuestionIds({}), []);
  });

  it('returns empty array when questions array is missing', () => {
    const passage = { isPassage: true };
    assert.deepStrictEqual(getPassageChildQuestionIds(passage), []);
  });
});

// ---- calculateAccuracyPercentage ----

describe('calculateAccuracyPercentage', () => {
  it('returns correct percentage', () => {
    assert.strictEqual(calculateAccuracyPercentage(7, 10), 70);
  });

  it('returns 0 when answeredCount is 0', () => {
    assert.strictEqual(calculateAccuracyPercentage(0, 0), 0);
  });

  it('returns 0 when answeredCount is negative', () => {
    assert.strictEqual(calculateAccuracyPercentage(5, -1), 0);
  });

  it('returns 100 when all answered correctly', () => {
    assert.strictEqual(calculateAccuracyPercentage(10, 10), 100);
  });

  it('rounds to nearest integer', () => {
    assert.strictEqual(calculateAccuracyPercentage(1, 3), 33);
  });
});

// ---- calculateCompletionPercentage ----

describe('calculateCompletionPercentage', () => {
  it('returns correct percentage', () => {
    assert.strictEqual(calculateCompletionPercentage(5, 20), 25);
  });

  it('returns 0 when maxScore is 0', () => {
    assert.strictEqual(calculateCompletionPercentage(5, 0), 0);
  });

  it('returns 0 when maxScore is negative', () => {
    assert.strictEqual(calculateCompletionPercentage(5, -1), 0);
  });

  it('returns 100 when all questions answered', () => {
    assert.strictEqual(calculateCompletionPercentage(10, 10), 100);
  });
});
