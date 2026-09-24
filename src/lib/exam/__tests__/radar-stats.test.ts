import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePeakRadarStats } from '../radar-stats';
import type { RadarAttemptInput } from '../radar-stats';

function createMockAttempt(overrides: Partial<RadarAttemptInput>): RadarAttemptInput {
  return {
    status: 'completed',
    completion_reason: 'finished',
    exams: {
      format: 'Digital',
    },
    section_scores: [],
    ...overrides,
  };
}

describe('calculatePeakRadarStats (Canonical Radar)', () => {
  it('deduplicates sections across multiple exams into single canonical subtest axes', () => {
    // 3 different exams with different UUIDs for Figure Sequences
    const test1 = createMockAttempt({
      section_scores: [
        { key: 'sec-uuid-test1-fig', label: 'Figure Sequences', correct: 10, total: 22 },
        { key: 'sec-uuid-test1-math', label: 'Mathematical Equations', correct: 15, total: 22 },
      ],
    });

    const test2 = createMockAttempt({
      section_scores: [
        { key: 'sec-uuid-test2-fig', label: 'Figure Sequences', correct: 20, total: 22 },
        { key: 'sec-uuid-test2-latin', label: 'Latin Squares', correct: 18, total: 22 },
      ],
    });

    const test3 = createMockAttempt({
      section_scores: [
        { key: 'sec-uuid-test3-fig', label: 'Figure Sequences', correct: 14, total: 22 },
      ],
    });

    const stats = calculatePeakRadarStats([test1, test2, test3], 'Digital', 'CS');

    // Exactly 4 canonical subtests for Digital format
    assert.equal(stats.length, 4);

    const figSeq = stats.find((s) => s.key === 'figure_sequence');
    assert.ok(figSeq, 'Should contain figure_sequence');
    assert.equal(figSeq.label, 'Figure Sequences');
    assert.equal(figSeq.percentage, 91); // Peak from test 2: 20/22 = 91%
    assert.equal(figSeq.correct, 20);

    const mathEq = stats.find((s) => s.key === 'math_equation');
    assert.ok(mathEq, 'Should contain math_equation');
    assert.equal(mathEq.percentage, 68); // 15/22 = 68%

    const latinSq = stats.find((s) => s.key === 'latin_square');
    assert.ok(latinSq, 'Should contain latin_square');
    assert.equal(latinSq.percentage, 82); // 18/22 = 82%

    const moduleMcq = stats.find((s) => s.key === 'module_mcq');
    assert.ok(moduleMcq, 'Should contain module_mcq');
    assert.equal(moduleMcq.percentage, 0); // Not attempted yet
  });

  it('unifies subtest scores across mock exams and subtest drills', () => {
    const mockAttempt = createMockAttempt({
      section_scores: [
        { key: 'uuid-1', label: 'Figure Sequences', correct: 18, total: 22 },
        { key: 'uuid-2', label: 'Latin Squares', correct: 12, total: 22 },
      ],
    });

    const drillAttempt = createMockAttempt({
      section_scores: [
        { key: 'uuid-drill', label: 'Latin Squares', correct: 21, total: 22 },
      ],
    });

    const stats = calculatePeakRadarStats([mockAttempt, drillAttempt], 'Digital', 'CS');

    const latinSq = stats.find((s) => s.key === 'latin_square');
    assert.ok(latinSq);
    assert.equal(latinSq.correct, 21); // Peak from drill is preserved
    assert.equal(latinSq.percentage, 95); // 21/22 = 95%
  });

  it('returns empty array when no completed attempts exist', () => {
    const inProgress = createMockAttempt({
      status: 'in_progress',
      section_scores: [
        { key: 'uuid-1', label: 'Figure Sequences', correct: 22, total: 22 },
      ],
    });

    const endedEarly = createMockAttempt({
      status: 'completed',
      completion_reason: 'ended_early',
      section_scores: [
        { key: 'uuid-2', label: 'Figure Sequences', correct: 22, total: 22 },
      ],
    });

    const stats = calculatePeakRadarStats([inProgress, endedEarly], 'Digital');
    assert.equal(stats.length, 0);
  });

  it('respects format override (Digital vs Paper)', () => {
    const digitalAttempt = createMockAttempt({
      exam_format: 'Digital',
      section_scores: [
        { key: 'uuid-fig', label: 'Figure Sequences', correct: 20, total: 22 },
      ],
    });

    const paperAttempt = createMockAttempt({
      exam_format: 'Paper',
      section_scores: [
        { key: 'uuid-pat', label: 'Completing Patterns', correct: 18, total: 22 },
      ],
    });

    const digitalStats = calculatePeakRadarStats([digitalAttempt, paperAttempt], 'Digital');
    const paperStats = calculatePeakRadarStats([digitalAttempt, paperAttempt], 'Paper', 'engineering');

    assert.ok(digitalStats.some((s) => s.key === 'figure_sequence'));
    assert.ok(paperStats.some((s) => s.key === 'figure_sequence')); // Paper has Completing Patterns
    assert.ok(paperStats.some((s) => s.key === 'eng_1')); // Engineering paper subtest
  });
});
