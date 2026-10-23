import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertToModulePassage,
  type QuestionData,
} from '../passage-helpers';

describe('convertToModulePassage', () => {
  it('correctly maps top-level passage image_url and resolved_image_url for mock exams (sc_2)', () => {
    const passage: QuestionData = {
      id: 'mock-sc2-passage-1',
      sectionId: 'sec-sc2',
      sortOrder: 1,
      questionType: 'sc_2',
      isPassage: true,
      title: 'TEXT AND FLOW CHART FOR QUESTIONS 2.1. AND 2.2.',
      body_markdown: 'A store discount campaign...',
      image_url: 'https://example.com/storage/depictions/flowchart_1-2.webp',
      resolved_image_url: 'https://example.com/storage/depictions/flowchart_1-2.webp',
      content: {},
      questions: [
        {
          id: 'sc2-q1',
          sectionId: 'sec-sc2',
          sortOrder: 1,
          questionType: 'sc_2',
          content: {
            question_text: 'Which of the following statements is or are correct?',
            options: {
              A: 'Only statement I is correct.',
              B: 'Only statement II is correct.',
            },
          },
        },
      ],
    };

    const modulePassage = convertToModulePassage(passage);
    assert.strictEqual(modulePassage.id, 'mock-sc2-passage-1');
    assert.strictEqual(modulePassage.title, 'TEXT AND FLOW CHART FOR QUESTIONS 2.1. AND 2.2.');
    assert.strictEqual(modulePassage.body_markdown, 'A store discount campaign...');
    assert.strictEqual(modulePassage.image_url, 'https://example.com/storage/depictions/flowchart_1-2.webp');
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/storage/depictions/flowchart_1-2.webp');
    assert.strictEqual(modulePassage.questions.length, 1);
    assert.strictEqual(modulePassage.questions[0].id, 'sc2-q1');
    assert.strictEqual(modulePassage.questions[0].content.question_text, 'Which of the following statements is or are correct?');
  });

  it('falls back to content.image_url and content.resolved_image_url when not at top-level', () => {
    const passage: QuestionData = {
      id: 'p-fallback',
      sectionId: 'sec-fallback',
      sortOrder: 1,
      questionType: 'sc_2',
      isPassage: true,
      content: {
        title: 'Embedded Title',
        body_markdown: 'Embedded markdown',
        image_url: 'https://example.com/raw.webp',
        resolved_image_url: 'https://example.com/resolved.webp',
      },
      questions: [],
    };

    const modulePassage = convertToModulePassage(passage);
    assert.strictEqual(modulePassage.title, 'Embedded Title');
    assert.strictEqual(modulePassage.body_markdown, 'Embedded markdown');
    assert.strictEqual(modulePassage.image_url, 'https://example.com/raw.webp');
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/resolved.webp');
  });

  it('falls back to resolved_image_url = image_url when resolved_image_url is missing', () => {
    const passage: QuestionData = {
      id: 'p-no-resolved',
      sectionId: 'sec-1',
      sortOrder: 1,
      questionType: 'sc_2',
      isPassage: true,
      image_url: 'https://example.com/direct.webp',
      content: {},
      questions: [],
    };

    const modulePassage = convertToModulePassage(passage);
    assert.strictEqual(modulePassage.image_url, 'https://example.com/direct.webp');
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/direct.webp');
  });

  it('falls back to content.passage_image_url for practice mode single questions', () => {
    const singleQuestion: QuestionData = {
      id: 'practice-q1',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      content: {
        passage_title: 'Practice Passage Title',
        passage_markdown: 'Practice passage body',
        passage_image_url: 'https://example.com/practice-passage.webp',
        question_text: 'Practice Question Stem',
        options: { A: 'A', B: 'B' },
      },
    };

    const modulePassage = convertToModulePassage(singleQuestion);
    assert.strictEqual(modulePassage.title, 'Practice Passage Title');
    assert.strictEqual(modulePassage.body_markdown, 'Practice passage body');
    assert.strictEqual(modulePassage.image_url, 'https://example.com/practice-passage.webp');
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/practice-passage.webp');
    assert.strictEqual(modulePassage.questions.length, 1);
    assert.strictEqual(modulePassage.questions[0].content.question_text, 'Practice Question Stem');
  });
});
