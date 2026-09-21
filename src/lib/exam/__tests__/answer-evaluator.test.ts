import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnswer } from '../answer-evaluator';

describe('evaluateAnswer', () => {
  describe('figure_sequence', () => {
    it('evaluates object user answer against array correct answer', () => {
      const correct = [2, 3];
      assert.strictEqual(evaluateAnswer('figure_sequence', { image1: 2, image2: 3 }, correct), true);
      assert.strictEqual(evaluateAnswer('figure_sequence', { image1: 1, image2: 3 }, correct), false);
      assert.strictEqual(evaluateAnswer('figure_sequence', { image1: 2, image2: 1 }, correct), false);
    });

    it('evaluates array user answer against array correct answer', () => {
      assert.strictEqual(evaluateAnswer('figure_sequence', [2, 3], [2, 3]), true);
      assert.strictEqual(evaluateAnswer('figure_sequence', [1, 2], [2, 3]), false);
    });

    it('handles null/incomplete answers gracefully', () => {
      assert.strictEqual(evaluateAnswer('figure_sequence', { image1: 2, image2: null }, [2, 3]), false);
      assert.strictEqual(evaluateAnswer('figure_sequence', null, [2, 3]), false);
    });
  });

  describe('numerical_series', () => {
    it('handles string vs number coercion', () => {
      assert.strictEqual(evaluateAnswer('numerical_series', '94', 94), true);
      assert.strictEqual(evaluateAnswer('numerical_series', 94, '94'), true);
      assert.strictEqual(evaluateAnswer('numerical_series', '  94  ', '94'), true);
      assert.strictEqual(evaluateAnswer('numerical_series', '93', 94), false);
    });
  });

  describe('math_equation', () => {
    it('evaluates variable maps', () => {
      const correct = { A: 8, B: 15 };
      assert.strictEqual(evaluateAnswer('math_equation', { A: 8, B: 15 }, correct), true);
      assert.strictEqual(evaluateAnswer('math_equation', { A: '8', B: '15' }, correct), true);
      assert.strictEqual(evaluateAnswer('math_equation', { A: 8, B: 14 }, correct), false);
      assert.strictEqual(evaluateAnswer('math_equation', { A: 8 }, correct), false);
    });
  });

  describe('standard MCQ (completing_patterns, latin_square, module_mcq)', () => {
    it('evaluates single letter answers case-insensitively with trimming', () => {
      assert.strictEqual(evaluateAnswer('completing_patterns', 'D', 'D'), true);
      assert.strictEqual(evaluateAnswer('completing_patterns', 'd', 'D'), true);
      assert.strictEqual(evaluateAnswer('completing_patterns', ' d ', 'D'), true);
      assert.strictEqual(evaluateAnswer('completing_patterns', 'C', 'D'), false);

      assert.strictEqual(evaluateAnswer('latin_square', 'b', 'B'), true);
      assert.strictEqual(evaluateAnswer('module_mcq', 'A', 'a'), true);
    });
  });
});
