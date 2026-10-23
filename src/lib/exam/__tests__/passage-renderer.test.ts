import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertToModulePassage,
  shouldRenderWithModuleMCQ,
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

  it('preserves passage_image_url when child question has its own question_image', () => {
    const singleQuestion: QuestionData = {
      id: 'practice-q2',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      content: {
        passage_title: 'Flowchart Title',
        passage_markdown: 'Flowchart description',
        passage_image_url: 'https://example.com/flowchart.webp',
        question_image: 'https://example.com/sub-graphic.webp',
        resolved_image_url: 'https://example.com/sub-graphic.webp',
        question_text: 'Which statement is correct?',
        options: { A: 'A', B: 'B' },
      },
    };

    const modulePassage = convertToModulePassage(singleQuestion);
    // Left pane passage graphic is strictly the flowchart
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/flowchart.webp');
    // Right pane question graphic is the question's sub-graphic
    assert.strictEqual(modulePassage.questions[0].content.resolved_image_url, 'https://example.com/sub-graphic.webp');
  });

  it('extracts image from body_markdown when image_url is missing', () => {
    const questionWithMdImg: QuestionData = {
      id: 'practice-md-img',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      content: {
        passage_title: 'Suit 5 Passage',
        passage_markdown: 'Text before\n\n![Original](https://example.com/storage/depictions/p_depiction_5.webp)\n\nText after',
        question_text: 'Question text',
        options: { A: 'A' },
      },
    };

    const modulePassage = convertToModulePassage(questionWithMdImg);
    assert.strictEqual(modulePassage.image_url, 'https://example.com/storage/depictions/p_depiction_5.webp');
    assert.strictEqual(modulePassage.resolved_image_url, 'https://example.com/storage/depictions/p_depiction_5.webp');
  });
});

describe('shouldRenderWithModuleMCQ routing for practice and exam modes', () => {
  it('routes practice passage questions (e.g. sc_2 with passage content) to ModuleMCQ', () => {
    const practiceQ: QuestionData = {
      id: 'sc2-practice-q1',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      content: {
        passage_title: 'Text and Flowchart for Tasks 3 and 4',
        passage_markdown: 'A student received the following flowchart...',
        passage_image_url: 'https://example.com/depictions/flowchart.webp',
        question_text: 'Which of the following statements is or are correct?',
        options: { A: 'A', B: 'B' },
      },
    };

    assert.strictEqual(shouldRenderWithModuleMCQ(practiceQ), true);
  });

  it('routes mock exam passage items (isPassage: true) to ModuleMCQ', () => {
    const mockPassageItem: QuestionData = {
      id: 'mock-passage-1',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      isPassage: true,
      content: {},
      questions: [],
    };

    assert.strictEqual(shouldRenderWithModuleMCQ(mockPassageItem), true);
  });

  it('routes digital module_mcq questions to ModuleMCQ', () => {
    const digitalQ: QuestionData = {
      id: 'digital-mcq-1',
      sectionId: 'sec-mod',
      sortOrder: 1,
      questionType: 'module_mcq',
      content: {},
    };

    assert.strictEqual(shouldRenderWithModuleMCQ(digitalQ), true);
  });

  it('routes standalone questions (e.g. sc_2 without passage) away from ModuleMCQ', () => {
    const standaloneQ: QuestionData = {
      id: 'sc2-standalone-q1',
      sectionId: 'sc_2',
      sortOrder: 1,
      questionType: 'sc_2',
      content: {
        context_text: 'Alin and Jens cannot agree...',
        question_image: 'https://example.com/depictions/standalone.webp',
        question_text: 'Which statement is correct?',
        options: { A: 'A', B: 'B' },
      },
    };

    assert.strictEqual(shouldRenderWithModuleMCQ(standaloneQ), false);
  });

  it('routes standard non-passage questions (econ_1, eng_3) away from ModuleMCQ', () => {
    const econQ: QuestionData = {
      id: 'econ-q1',
      sectionId: 'econ_1',
      sortOrder: 1,
      questionType: 'econ_1',
      content: {
        question_image: 'https://example.com/econ_a.webp',
        question_image_2: 'https://example.com/econ_b.webp',
        question_text: 'Which graph?',
        options: { A: 'A', B: 'B' },
      },
    };

    assert.strictEqual(shouldRenderWithModuleMCQ(econQ), false);
  });
});
