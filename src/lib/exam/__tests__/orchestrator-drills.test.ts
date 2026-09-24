import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStoredSections, buildExamFlow } from '../orchestrator';
import type { ExamPayload, ExamQuestionRecord } from '../orchestrator';
import type { Section, QuestionType } from '@/lib/types';

function createMockSection(id: string, title: string, questionType: QuestionType, sortOrder: number): Section {
  return {
    id,
    exam_id: 'exam-1',
    title,
    description: null,
    question_type: questionType,
    sort_order: sortOrder,
    duration_seconds: 1800,
    question_count: 22,
    environment_content: null,
    created_at: new Date().toISOString(),
  };
}

function createMockQuestion(id: string, sectionId: string): ExamQuestionRecord {
  return {
    id,
    section_id: sectionId,
  };
}

describe('orchestrator - Subtest Drills', () => {
  const sections: Section[] = [
    createMockSection('sec-1', 'Completing Patterns', 'completing_patterns', 1),
    createMockSection('sec-2', 'Solving Quantitative Problems', 'solving_quantitative', 2),
    createMockSection('sec-3', 'Numerical Series', 'numerical_series', 3),
    createMockSection('sec-digital', 'Latin Squares', 'latin_square', 4),
  ];

  const questions: ExamQuestionRecord[] = [
    createMockQuestion('q-1', 'sec-1'),
    createMockQuestion('q-2', 'sec-1'),
    createMockQuestion('q-3', 'sec-2'),
    createMockQuestion('q-4', 'sec-3'),
    createMockQuestion('q-5', 'sec-digital'),
  ];

  const payload: ExamPayload = {
    exam: {
      format: 'Paper',
    },
    sections,
    questions,
  };

  it('buildStoredSections scopes strictly to single section ID for drill', () => {
    const drillSections = buildStoredSections(payload, true, null, ['sec-2']);

    assert.equal(drillSections.length, 1);
    assert.equal(drillSections[0].id, 'sec-2');
    assert.equal(drillSections[0].title, 'Solving Quantitative Problems');
    assert.deepStrictEqual(drillSections[0].questionIds, ['q-3']);
    assert.equal(drillSections[0].questionCount, 1);
  });

  it('buildStoredSections rejects sections that do not belong to the active format/module', () => {
    // sec-digital is latin_square, which is Digital only, so it must not be admitted for a Paper drill
    const drillSections = buildStoredSections(payload, true, null, ['sec-digital']);
    assert.equal(drillSections.length, 0);
  });

  it('buildStoredSections preserves database sort_order regardless of input array order', () => {
    const drillSections = buildStoredSections(payload, true, null, ['sec-3', 'sec-1']);

    assert.equal(drillSections.length, 2);
    assert.equal(drillSections[0].id, 'sec-1');
    assert.equal(drillSections[1].id, 'sec-3');
    assert.deepStrictEqual(drillSections[0].questionIds, ['q-1', 'q-2']);
    assert.deepStrictEqual(drillSections[1].questionIds, ['q-4']);
  });

  it('buildStoredSections falls back to standard full exam filtering when allowedSectionIds is null or empty', () => {
    const defaultSections = buildStoredSections(payload, true, null, null);
    assert.ok(defaultSections.length > 1);

    const emptyArraySections = buildStoredSections(payload, true, null, []);
    assert.ok(emptyArraySections.length > 1);
  });

  it('buildExamFlow creates zero breaks for a single-section drill', () => {
    const singleSection = buildStoredSections(payload, true, null, ['sec-1']);
    const flow = buildExamFlow(singleSection, true);

    assert.equal(flow.length, 1);
    assert.deepStrictEqual(flow[0], { type: 'section', sectionIndex: 0 });
    assert.ok(flow.every((step) => step.type !== 'break'));
  });

  it('buildExamFlow creates alternating breaks for multi-section mock exams', () => {
    const multiSections = buildStoredSections(payload, true, null, ['sec-1', 'sec-2']);
    const flow = buildExamFlow(multiSections, true);

    assert.equal(flow.length, 3);
    assert.deepStrictEqual(flow[0], { type: 'section', sectionIndex: 0 });
    assert.equal(flow[1].type, 'break');
    assert.deepStrictEqual(flow[2], { type: 'section', sectionIndex: 1 });
  });
});
