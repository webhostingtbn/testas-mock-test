import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pickDefaultExam } from '../exam-select';

const paper = { id: 'paper-1', format: 'Paper' as const };
const digital = { id: 'digital-1', format: 'Digital' as const };

describe('pickDefaultExam', () => {
  it('returns null for an empty list', () => {
    assert.strictEqual(pickDefaultExam([], 'Digital'), null);
  });

  it('prefers the profile format match regardless of order', () => {
    assert.strictEqual(pickDefaultExam([paper, digital], 'Digital'), digital);
    assert.strictEqual(pickDefaultExam([paper, digital], 'Paper'), paper);
    assert.strictEqual(pickDefaultExam([paper, digital], 'digital'), digital);
  });

  it('prefers Digital when no format is chosen yet', () => {
    assert.strictEqual(pickDefaultExam([paper, digital], null), digital);
    assert.strictEqual(pickDefaultExam([paper, digital], undefined), digital);
  });

  it('falls back to the first exam when nothing matches', () => {
    assert.strictEqual(pickDefaultExam([paper], 'Digital'), paper);
    assert.strictEqual(pickDefaultExam([paper], null), paper);
  });
});
