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

    it('evaluates TestAS answer sheet digit marks regardless of click order or repeated digits', () => {
      // User case from practice screenshot: answer is 1029, user marked digits 0, 1, 2, 9
      assert.strictEqual(evaluateAnswer('numerical_series', '0129', 1029), true);
      assert.strictEqual(evaluateAnswer('numerical_series', '1209', 1029), true);
      // Repeated digits in correct answer (88 only marks digit 8)
      assert.strictEqual(evaluateAnswer('numerical_series', '8', 88), true);
      assert.strictEqual(evaluateAnswer('numerical_series', '8', '88'), true);
      // Repeated zeros (100 only marks digits 0 and 1)
      assert.strictEqual(evaluateAnswer('numerical_series', '01', 100), true);
      // Negative numbers
      assert.strictEqual(evaluateAnswer('numerical_series', '-9', '-9'), true);
      assert.strictEqual(evaluateAnswer('numerical_series', '9-', '-9'), true);
      // Wrong answers
      assert.strictEqual(evaluateAnswer('numerical_series', '01293', 1029), false);
      assert.strictEqual(evaluateAnswer('numerical_series', '129', 1029), false);
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
