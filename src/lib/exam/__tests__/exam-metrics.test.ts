import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateExamMetrics, type MetricSectionInput } from '../metrics';

describe('calculateExamMetrics', () => {
  it('returns default fallback metrics when sections is null or empty', () => {
    const digitalDefault = calculateExamMetrics(null, false, null);
    assert.deepStrictEqual(digitalDefault, {
      sectionsCount: 0,
      questionCount: 90,
      durationMinutes: 130,
    });

    const paperDefault = calculateExamMetrics([], true, null);
    assert.deepStrictEqual(paperDefault, {
      sectionsCount: 0,
      questionCount: 120,
      durationMinutes: 170,
    });
  });

  it('calculates metrics for a 3-section Digital exam with no module', () => {
    const sections: MetricSectionInput[] = [
      {
        id: 's1',
        title: 'Figure Sequence',
        question_type: 'figure_sequence',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 0,
      },
      {
        id: 's2',
        title: 'Mathematical Equations',
        question_type: 'math_equation',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 1,
      },
      {
        id: 's3',
        title: 'Latin Square',
        question_type: 'latin_square',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 2,
      },
    ];

    // Digital Test Suit 2-5: 3 sections, 60 questions, (75 min section time + 4 min breaks = 79 min)
    const metrics = calculateExamMetrics(sections, false, null);
    assert.deepStrictEqual(metrics, {
      sectionsCount: 3,
      questionCount: 60,
      durationMinutes: 79,
    });
  });

  it('calculates metrics for a 2-section Digital exam (e.g. Digital Test Suit 6)', () => {
    const sections: MetricSectionInput[] = [
      {
        id: 's1',
        title: 'Figure Sequence',
        question_type: 'figure_sequence',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 0,
      },
      {
        id: 's2',
        title: 'Mathematical Equations',
        question_type: 'math_equation',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 1,
      },
    ];

    // 2 sections, 40 questions, (50 min section time + 2 min break = 52 min)
    const metrics = calculateExamMetrics(sections, false, null);
    assert.deepStrictEqual(metrics, {
      sectionsCount: 2,
      questionCount: 40,
      durationMinutes: 52,
    });
  });

  it('calculates metrics for a 1-section Digital exam (e.g. Digital Test Suit 10)', () => {
    const sections: MetricSectionInput[] = [
      {
        id: 's1',
        title: 'Figure Sequence',
        question_type: 'figure_sequence',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 0,
      },
    ];

    // 1 section, 20 questions, 25 min, 0 breaks
    const metrics = calculateExamMetrics(sections, false, null);
    assert.deepStrictEqual(metrics, {
      sectionsCount: 1,
      questionCount: 20,
      durationMinutes: 25,
    });
  });

  it('filters module sections matching the user active module and includes long break', () => {
    const sections: MetricSectionInput[] = [
      {
        id: 's1',
        title: 'Figure Sequence',
        question_type: 'figure_sequence',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 0,
      },
      {
        id: 's2',
        title: 'Mathematical Equations',
        question_type: 'math_equation',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 1,
      },
      {
        id: 's3',
        title: 'Latin Square',
        question_type: 'latin_square',
        duration_seconds: 1500,
        question_count: 20,
        sort_order: 2,
      },
      {
        id: 's4_cs',
        title: 'Natural Science and Computer Science',
        question_type: 'module_mcq',
        duration_seconds: 5400,
        question_count: 65,
        sort_order: 3,
      },
      {
        id: 's4_econ',
        title: 'Economics',
        question_type: 'module_mcq',
        duration_seconds: 5400,
        question_count: 52,
        sort_order: 3,
      },
    ];

    // For CS module user: 3 core (60q) + CS module (65q) = 125 questions
    // Duration: 75m core + 90m module + 4m core breaks + 30m long break = 199m
    const csMetrics = calculateExamMetrics(sections, false, 'natural_computer_science');
    assert.deepStrictEqual(csMetrics, {
      sectionsCount: 4,
      questionCount: 125,
      durationMinutes: 199,
    });

    // For Economics module user: 3 core (60q) + Econ module (52q) = 112 questions
    const econMetrics = calculateExamMetrics(sections, false, 'economics');
    assert.deepStrictEqual(econMetrics, {
      sectionsCount: 4,
      questionCount: 112,
      durationMinutes: 199,
    });
  });

  it('correctly handles Paper exams with module sections', () => {
    const sections: MetricSectionInput[] = [
      {
        id: 'p1',
        title: 'Solving Quantitative Problems',
        question_type: 'solving_quantitative',
        duration_seconds: 2700,
        question_count: 22,
        sort_order: 1,
      },
      {
        id: 'p2',
        title: 'Inferring Relationships',
        question_type: 'inferring_relationships',
        duration_seconds: 600,
        question_count: 22,
        sort_order: 2,
      },
      {
        id: 'p3',
        title: 'Completing Patterns',
        question_type: 'completing_patterns',
        duration_seconds: 1500,
        question_count: 22,
        sort_order: 3,
      },
      {
        id: 'p4',
        title: 'Numerical Series',
        question_type: 'numerical_series',
        duration_seconds: 1800,
        question_count: 22,
        sort_order: 4,
      },
      {
        id: 'p5',
        title: 'Analyzing Scientific Relationships',
        question_type: 'sc_1',
        duration_seconds: 2700,
        question_count: 22,
        sort_order: 5,
      },
      {
        id: 'p6',
        title: 'Understanding Formal Depictions',
        question_type: 'sc_2',
        duration_seconds: 5100,
        question_count: 22,
        sort_order: 6,
      },
    ];

    const metrics = calculateExamMetrics(sections, true, 'natural_computer_science');
    // 6 sections, 22 * 6 = 132 questions
    assert.equal(metrics.sectionsCount, 6);
    assert.equal(metrics.questionCount, 132);
    assert.ok(metrics.durationMinutes > 0);
  });
});
