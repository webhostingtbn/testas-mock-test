import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuestionSourceHash,
  computePassageSourceHash,
  computeSectionSourceHash,
  processTranslationPayload,
  isValidUuid,
  type DbQuestionRow,
  type DbPassageRow,
  type DbSectionRow,
  type TranslationInputPayload,
} from '../../../../scripts/import-translations';

const Q_ID_1 = '11111111-1111-4111-8111-111111111111';
const Q_ID_REVIEW = '22222222-2222-4222-8222-222222222222';
const Q_ID_VALID = '33333333-3333-4333-8333-333333333333';
const P_ID_VALID = '44444444-4444-4444-8444-444444444444';
const S_ID_VALID = '55555555-5555-4555-8555-555555555555';

describe('import-translations hashing and validation', () => {
  it('computes deterministic sha256 hash for question content with sorted option keys', () => {
    const content1 = {
      question_text: 'What is the capital of Germany?',
      options: [
        { id: 'B', text: 'Munich' },
        { id: 'A', text: 'Berlin' },
      ],
    };

    const content2 = {
      question_text: 'What is the capital of Germany?',
      options: [
        { id: 'A', text: 'Berlin' },
        { id: 'B', text: 'Munich' },
      ],
    };

    const hash1 = computeQuestionSourceHash(content1);
    const hash2 = computeQuestionSourceHash(content2);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64);
    assert.strictEqual(hash1, hash2, 'Hash must be identical regardless of option array order');

    // Modifying question text changes hash
    const contentModified = {
      ...content1,
      question_text: 'What is the capital city of Germany?',
    };
    const hashModified = computeQuestionSourceHash(contentModified);
    assert.notStrictEqual(hash1, hashModified, 'Modifying English question text must produce a different hash (stale detection)');
  });

  it('computes deterministic hash for passage and section', () => {
    const passageHash = computePassageSourceHash('Title', 'Body markdown');
    assert.strictEqual(typeof passageHash, 'string');
    assert.strictEqual(passageHash.length, 64);

    const sectionHash = computeSectionSourceHash('Section 1', 'Description', { text: 'Environment info' });
    assert.strictEqual(typeof sectionHash, 'string');
    assert.strictEqual(sectionHash.length, 64);
  });

  it('validates UUID format correctly', () => {
    assert.strictEqual(isValidUuid(Q_ID_1), true);
    assert.strictEqual(isValidUuid('invalid-uuid'), false);
    assert.strictEqual(isValidUuid(''), false);
    assert.strictEqual(isValidUuid(null), false);
    assert.strictEqual(isValidUuid(123), false);
  });

  it('reports validation issues for malformed UUIDs and rejects processing', () => {
    const payload: TranslationInputPayload = {
      lang: 'de',
      questions: [{ id: 'not-a-valid-uuid', question_text: 'Hallo' }],
      passages: [{ id: 'bad-passage-id', body_markdown: 'Text' }],
      sections: [{ id: 'bad-section-id', description: 'Desc' }],
    };

    const result = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions: new Map(),
      basePassages: new Map(),
      baseSections: new Map(),
    });

    assert.strictEqual(result.issues.length, 3);
    assert.ok(result.issues.some((i) => i.kind === 'question' && i.issues.includes('Invalid UUID format')));
    assert.ok(result.issues.some((i) => i.kind === 'passage' && i.issues.includes('Invalid UUID format')));
    assert.ok(result.issues.some((i) => i.kind === 'section' && i.issues.includes('Invalid UUID format')));
  });

  it('reports validation issues for invalid option id and rejects update', () => {
    const baseQuestion: DbQuestionRow = {
      id: Q_ID_1,
      question_type: 'module_mcq',
      content: {
        question_text: 'Select the right answer',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
        ],
      },
      translations: {},
    };

    const payload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: Q_ID_1,
          question_text: 'Wählen Sie die richtige Antwort',
          options: {
            A: 'Option A (DE)',
            B: 'Option B (DE)',
            Z: 'Option Z (Invalid)',
          },
        },
      ],
    };

    const baseQuestions = new Map<string, DbQuestionRow>([[Q_ID_1, baseQuestion]]);
    const basePassages = new Map<string, DbPassageRow>();
    const baseSections = new Map<string, DbSectionRow>();

    const result = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions,
      basePassages,
      baseSections,
    });

    assert.strictEqual(result.issues.length, 1);
    assert.strictEqual(result.issues[0]?.kind, 'question');
    assert.strictEqual(result.issues[0]?.id, Q_ID_1);
    assert.ok(result.issues[0]?.issues.some((msg) => msg.includes('Unknown option id: "Z"')));
    assert.strictEqual(result.questionUpdates.length, 0);
  });

  it('rejects partial translation when base options have text but are missing in translation', () => {
    const baseQuestion: DbQuestionRow = {
      id: Q_ID_1,
      question_type: 'module_mcq',
      content: {
        question_text: 'English Question Text',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
        ],
      },
      translations: {},
    };

    // 1. Missing options entirely
    const resNoOptions = processTranslationPayload({
      payload: {
        lang: 'de',
        questions: [{ id: Q_ID_1, question_text: 'Deutscher Text' }],
      },
      isReviewed: false,
      baseQuestions: new Map([[Q_ID_1, baseQuestion]]),
      basePassages: new Map(),
      baseSections: new Map(),
    });
    assert.strictEqual(resNoOptions.issues.length, 1);
    assert.ok(resNoOptions.issues[0]?.issues.some((m) => m.includes('Option "A" is required when base has text')));
    assert.ok(resNoOptions.issues[0]?.issues.some((m) => m.includes('Option "B" is required when base has text')));

    // 2. Partial options
    const resPartial = processTranslationPayload({
      payload: {
        lang: 'de',
        questions: [{ id: Q_ID_1, question_text: 'Deutscher Text', options: { A: 'Option A (DE)' } }],
      },
      isReviewed: false,
      baseQuestions: new Map([[Q_ID_1, baseQuestion]]),
      basePassages: new Map(),
      baseSections: new Map(),
    });
    assert.strictEqual(resPartial.issues.length, 1);
    assert.ok(resPartial.issues[0]?.issues.some((m) => m.includes('Option "B" is required when base has text')));
  });

  it('rejects passage translation when base title is missing in translation', () => {
    const basePassage: DbPassageRow = {
      id: P_ID_VALID,
      title: 'Passage Title',
      body_markdown: 'English Body Markdown',
      translations: {},
    };

    const result = processTranslationPayload({
      payload: {
        lang: 'de',
        passages: [{ id: P_ID_VALID, body_markdown: 'Deutscher Inhalt' }],
      },
      isReviewed: false,
      baseQuestions: new Map(),
      basePassages: new Map([[P_ID_VALID, basePassage]]),
      baseSections: new Map(),
    });

    assert.strictEqual(result.issues.length, 1);
    assert.ok(result.issues[0]?.issues.some((m) => m.includes('title is required when base has text')));
  });

  it('rejects unreviewed translation for passages in linguistic_structures / interpreting_texts sections', () => {
    const basePassage: DbPassageRow = {
      id: P_ID_VALID,
      title: 'Passage Title',
      body_markdown: 'English Body',
      section_question_type: 'interpreting_texts',
      translations: {},
    };

    const payload: TranslationInputPayload = {
      lang: 'de',
      passages: [
        {
          id: P_ID_VALID,
          title: 'Deutscher Titel',
          body_markdown: 'Deutscher Text',
        },
      ],
    };

    // 1. Without isReviewed
    const unreviewedResult = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions: new Map(),
      basePassages: new Map([[P_ID_VALID, basePassage]]),
      baseSections: new Map(),
    });
    assert.ok(unreviewedResult.issues.length > 0);
    assert.ok(
      unreviewedResult.issues[0]?.issues.some((msg) => msg.includes('requires review')),
      'Must require --reviewed flag for passages in interpreting_texts'
    );

    // 2. With isReviewed: true
    const reviewedResult = processTranslationPayload({
      payload,
      isReviewed: true,
      baseQuestions: new Map(),
      basePassages: new Map([[P_ID_VALID, basePassage]]),
      baseSections: new Map(),
    });
    assert.strictEqual(reviewedResult.issues.length, 0);
    assert.strictEqual(reviewedResult.passageUpdates.length, 1);
  });

  it('rejects partial translation when base question has question_text', () => {
    const baseQuestion: DbQuestionRow = {
      id: Q_ID_1,
      question_type: 'module_mcq',
      content: {
        question_text: 'English Question Text',
        options: [{ id: 'A', text: 'Option A' }],
      },
      translations: {},
    };

    const payload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: Q_ID_1,
          options: { A: 'Option A (DE)' },
        },
      ],
    };

    const result = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions: new Map([[Q_ID_1, baseQuestion]]),
      basePassages: new Map(),
      baseSections: new Map(),
    });

    assert.strictEqual(result.issues.length, 1);
    assert.ok(result.issues[0]?.issues.some((msg) => msg.includes('question_text is required when base has text')));
    assert.strictEqual(result.questionUpdates.length, 0);
  });

  it('rejects unreviewed translation for linguistic_structures / interpreting_texts', () => {
    const baseQuestion: DbQuestionRow = {
      id: Q_ID_REVIEW,
      question_type: 'linguistic_structures',
      content: {
        question_text: 'Analyze the text',
        options: [{ id: 'A', text: 'Text A' }],
      },
      translations: {},
    };

    const payload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: Q_ID_REVIEW,
          question_text: 'Analysieren Sie den Text',
          options: { A: 'Text A (DE)' },
        },
      ],
    };

    const baseQuestions = new Map<string, DbQuestionRow>([[Q_ID_REVIEW, baseQuestion]]);
    const basePassages = new Map<string, DbPassageRow>();
    const baseSections = new Map<string, DbSectionRow>();

    // 1. Without isReviewed
    const unreviewedResult = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions,
      basePassages,
      baseSections,
    });
    assert.ok(unreviewedResult.issues.length > 0);
    assert.ok(
      unreviewedResult.issues[0]?.issues.some((msg) => msg.includes('requires review')),
      'Must require --reviewed flag for linguistic_structures'
    );

    // 2. With isReviewed: true
    const reviewedResult = processTranslationPayload({
      payload,
      isReviewed: true,
      baseQuestions,
      basePassages,
      baseSections,
    });
    assert.strictEqual(reviewedResult.issues.length, 0);
    assert.strictEqual(reviewedResult.questionUpdates.length, 1);
    assert.strictEqual(reviewedResult.questionUpdates[0]?.id, Q_ID_REVIEW);
    assert.strictEqual(typeof reviewedResult.questionUpdates[0]?.translationWithHash._source_hash, 'string');
  });

  it('successfully processes valid questions, passages, and sections with source hashes', () => {
    const baseQuestion: DbQuestionRow = {
      id: Q_ID_VALID,
      question_type: 'module_mcq',
      content: {
        question_text: 'English question',
        options: { A: 'Option A', B: 'Option B' },
      },
      translations: {},
    };

    const basePassage: DbPassageRow = {
      id: P_ID_VALID,
      title: 'Passage Title',
      body_markdown: 'English Body',
      translations: {},
    };

    const baseSection: DbSectionRow = {
      id: S_ID_VALID,
      title: 'Section Title',
      description: 'Section Description',
      environment_content: { text: 'Environment info' },
      translations: {},
    };

    const payload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: Q_ID_VALID,
          question_text: 'Deutsche Frage',
          options: { A: 'Option A (DE)', B: 'Option B (DE)' },
        },
      ],
      passages: [
        {
          id: P_ID_VALID,
          title: 'Deutscher Titel',
          body_markdown: 'Deutscher Text',
        },
      ],
      sections: [
        {
          id: S_ID_VALID,
          title: 'Deutscher Abschnitt',
          description: 'Deutsche Beschreibung',
          environment_content: { text: 'Umgebungsinformationen' },
        },
      ],
    };

    const result = processTranslationPayload({
      payload,
      isReviewed: false,
      baseQuestions: new Map([[Q_ID_VALID, baseQuestion]]),
      basePassages: new Map([[P_ID_VALID, basePassage]]),
      baseSections: new Map([[S_ID_VALID, baseSection]]),
    });

    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.questionUpdates.length, 1);
    assert.strictEqual(result.passageUpdates.length, 1);
    assert.strictEqual(result.sectionUpdates.length, 1);

    assert.strictEqual(result.questionUpdates[0]?.translationWithHash.question_text, 'Deutsche Frage');
    assert.strictEqual(typeof result.questionUpdates[0]?.translationWithHash._source_hash, 'string');
    assert.strictEqual(result.passageUpdates[0]?.translationWithHash.title, 'Deutscher Titel');
    assert.strictEqual(typeof result.passageUpdates[0]?.translationWithHash._source_hash, 'string');
    assert.strictEqual(result.sectionUpdates[0]?.translationWithHash.title, 'Deutscher Abschnitt');
    assert.strictEqual(typeof result.sectionUpdates[0]?.translationWithHash._source_hash, 'string');
  });
});
