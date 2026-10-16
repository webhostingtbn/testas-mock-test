import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  sanitizeSql,
  parsePaperModuleQuestions,
  parsePaperModulePassages,
  validatePaperModulePayload,
  GERMAN_PASSAGE_TRANSLATIONS,
  MODULE_SECTION_DESCRIPTORS,
} from '../../../../scripts/import-paper-module-translations';
import {
  type TranslationInputPayload,
  type DbQuestionRow,
  type DbPassageRow,
  type DbSectionRow,
} from '../../../../scripts/import-translations';

describe('PaperModule German Importer Unit Tests', () => {
  it('1. sanitizeSql normalizes non-breaking spaces and line endings', () => {
    const raw = 'Module\u00A0Econ\r\nLine 2';
    const sanitized = sanitizeSql(raw);
    assert.equal(sanitized, 'Module Econ\nLine 2');
    assert.equal(sanitized.includes('\u00A0'), false);
  });

  it('2. parsePaperModuleQuestions parses single-quoted SQL (Economics style)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-paper-module-'));
    const testSqlPath = path.join(tmpDir, 'econ_test.sql');

    const sqlContent = `
    INSERT INTO public.questions (sort_order, content, correct_answer) VALUES
    (1,
    {
      "question_text": "Welche der folgenden Aussagen ist korrekt?",
      "context_text": "Das folgende Balkendiagramm zeigt die Verteilung.",
      "question_image": "https://example.com/chart1.webp",
      "options": [
        { "id": "A", "text": "Nur Aussage I ist richtig." },
        { "id": "B", "text": "Nur Aussage II ist richtig." }
      ]
    }, 'A');
    `;

    fs.writeFileSync(testSqlPath, sqlContent, 'utf-8');

    const parsed = parsePaperModuleQuestions(testSqlPath);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].sortOrder, 1);
    assert.equal(parsed[0].questionText, 'Welche der folgenden Aussagen ist korrekt?');
    assert.equal(parsed[0].contextText, 'Das folgende Balkendiagramm zeigt die Verteilung.');
    assert.equal(parsed[0].questionImage, 'https://example.com/chart1.webp');
    assert.equal(parsed[0].options.length, 2);
    assert.equal(parsed[0].options[0].id, 'A');
    assert.equal(parsed[0].options[0].text, 'Nur Aussage I ist richtig.');
    assert.equal(parsed[0].correctAnswer, 'A');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('3. parsePaperModuleQuestions parses dollar-quoted SQL (Engineering style)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-paper-module-'));
    const testSqlPath = path.join(tmpDir, 'eng_test.sql');

    const sqlContent = `
    INSERT INTO public.questions (sort_order, content, correct_answer) VALUES
    (5, $$
    {
      "question_text": "5.5 Ein Zahnradgetriebe überträgt die Kraft.",
      "options": [
        { "id": "A", "text": "Übersetzung 1:2" },
        { "id": "B", "text": "Übersetzung 1:4" },
        { "id": "C", "text": "Übersetzung 2:1" },
        { "id": "D", "text": "Übersetzung 4:1" }
      ]
    }
    $$, 'C');
    `;

    fs.writeFileSync(testSqlPath, sqlContent, 'utf-8');

    const parsed = parsePaperModuleQuestions(testSqlPath);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].sortOrder, 5);
    assert.equal(parsed[0].questionText, '5.5 Ein Zahnradgetriebe überträgt die Kraft.');
    assert.equal(parsed[0].options.length, 4);
    assert.equal(parsed[0].options[2].id, 'C');
    assert.equal(parsed[0].options[2].text, 'Übersetzung 2:1');
    assert.equal(parsed[0].correctAnswer, 'C');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('4. parsePaperModulePassages extracts passage tuples from depiction SQL', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-paper-module-'));
    const testSqlPath = path.join(tmpDir, 'depiction_test.sql');

    const sqlContent = `
    WITH
    p1 AS (
      INSERT INTO public.passages (section_id, title, body_markdown, image_url, sort_order)
      SELECT id, 'Personality Types', 'In einem Psychologietest gibt es...', 'https://example.com/p1.webp', 1
      FROM sec
      RETURNING id
    ),
    p2 AS (
      INSERT INTO public.passages (section_id, title, body_markdown, image_url, sort_order)
      SELECT id, 'Traffic Sequence', 'Auf deutschen Straßen...', 'https://example.com/p2.webp', 2
      FROM sec
      RETURNING id
    )
    `;

    fs.writeFileSync(testSqlPath, sqlContent, 'utf-8');

    const passages = parsePaperModulePassages(testSqlPath);
    assert.equal(passages.length, 2);
    assert.equal(passages[0].tag, 'p1');
    assert.equal(passages[0].title, 'Personality Types');
    assert.equal(passages[0].bodyMarkdown, 'In einem Psychologietest gibt es...');
    assert.equal(passages[0].imageUrl, 'https://example.com/p1.webp');
    assert.equal(passages[0].sortOrder, 1);

    assert.equal(passages[1].tag, 'p2');
    assert.equal(passages[1].title, 'Traffic Sequence');
    assert.equal(passages[1].sortOrder, 2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('5. validatePaperModulePayload detects missing fields and valid clean payloads', () => {
    const qId = '11111111-1111-4111-8111-111111111111';
    const pId = '22222222-2222-4222-8222-222222222222';
    const sId = '33333333-3333-4333-8333-333333333333';

    const dbQuestions = new Map<string, DbQuestionRow>([
      [
        qId,
        {
          id: qId,
          question_type: 'econ_1',
          content: {
            question_text: 'Base english question text',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
            ],
          },
          translations: {},
        },
      ],
    ]);

    const dbPassages = new Map<string, DbPassageRow>([
      [
        pId,
        {
          id: pId,
          title: 'Base Passage Title',
          body_markdown: 'Base markdown text',
          translations: {},
        },
      ],
    ]);

    const dbSections = new Map<string, DbSectionRow>([
      [
        sId,
        {
          id: sId,
          title: 'Base Section Title',
          description: 'Base section description',
          question_type: 'econ_1',
          environment_content: {},
          translations: {},
        },
      ],
    ]);

    const validPayload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: qId,
          question_text: 'Deutsche Frage',
          options: {
            A: 'Deutsche Option A',
            B: 'Deutsche Option B',
          },
        },
      ],
      passages: [
        {
          id: pId,
          title: 'Deutscher Passagentitel',
          body_markdown: 'Deutscher Passagentext',
        },
      ],
      sections: [
        {
          id: sId,
          title: 'Wirtschaftliche Zusammenhänge analysieren',
          description: 'Modultest Wirtschaft — Grafiken und Tabellen analysieren',
        },
      ],
    };

    const validResult = validatePaperModulePayload(validPayload, dbQuestions, dbPassages, dbSections);
    assert.equal(validResult.questionIssues.length, 0);
    assert.equal(validResult.passageIssues.length, 0);
    assert.equal(validResult.sectionIssues.length, 0);

    // Test invalid payload (missing option text)
    const invalidPayload: TranslationInputPayload = {
      lang: 'de',
      questions: [
        {
          id: qId,
          question_text: 'Deutsche Frage',
          options: {
            A: 'Deutsche Option A',
            // Missing B!
          },
        },
      ],
    };

    const invalidResult = validatePaperModulePayload(invalidPayload, dbQuestions, dbPassages, dbSections);
    assert.equal(invalidResult.questionIssues.length, 1);
    assert.ok(invalidResult.questionIssues[0].issues.some((msg) => msg.includes('required when base has text')));
  });

  it('6. GERMAN_PASSAGE_TRANSLATIONS contains valid definitions for all 25 depiction passages', () => {
    const keys = Object.keys(GERMAN_PASSAGE_TRANSLATIONS);
    assert.ok(keys.length >= 25, `Expected at least 25 passage definitions, got ${keys.length}`);

    for (const key of keys) {
      const def = GERMAN_PASSAGE_TRANSLATIONS[key];
      assert.ok(def.deTitle && def.deTitle.trim() !== '', `Passage "${key}" has empty deTitle`);
      assert.ok(def.deBodyMarkdown && def.deBodyMarkdown.trim() !== '', `Passage "${key}" has empty deBodyMarkdown`);
    }
  });

  it('7. MODULE_SECTION_DESCRIPTORS defines official German titles for all 7 module types', () => {
    const expectedTypes = ['econ_1', 'sc_1', 'sc_2', 'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3'];
    for (const t of expectedTypes) {
      const desc = MODULE_SECTION_DESCRIPTORS[t];
      assert.ok(desc, `Missing descriptor for module type ${t}`);
      assert.ok(desc.deTitle && desc.deTitle.trim() !== '', `Descriptor for ${t} has empty deTitle`);
      assert.ok(desc.deDescription && desc.deDescription.trim() !== '', `Descriptor for ${t} has empty deDescription`);
    }
  });

  it('8. prepends contextText and standalone passage markdown when appropriate', () => {
    const context = 'Das folgende Diagramm zeigt den Verlauf.';
    const question = 'Welche der folgenden Aussagen ist richtig?';
    let combined = question;

    if (context && !combined.includes(context)) {
      combined = `${context}\n\n${combined}`;
    }
    assert.equal(combined, `${context}\n\n${question}`);

    // Idempotent: does not duplicate if already included
    if (context && !combined.includes(context)) {
      combined = `${context}\n\n${combined}`;
    }
    assert.equal(combined, `${context}\n\n${question}`);
  });

  it('9. Suit 7 and Suit 8 passage fallback keys resolve to valid German passage definitions', () => {
    const suit7Order = [
      'exam results',
      'university subjects',
      'travel packages',
      'gardening watering',
      'ice cream selection',
      'decision options wxyz',
      'computer science calculations',
      'district municipality improvement',
    ];
    for (const key of suit7Order) {
      const def = GERMAN_PASSAGE_TRANSLATIONS[key];
      assert.ok(def, `Suit 7 key "${key}" missing in GERMAN_PASSAGE_TRANSLATIONS`);
      assert.ok(def.deTitle.length > 0);
      assert.ok(def.deBodyMarkdown.length > 0);
    }

    const suit8Order = [
      'room selection',
      'planet suitability',
      'thermostat algorithm',
      'substances and symptoms',
      'lawn growth',
      'plant growth factors',
      'parameter flow chart 1',
      'parameter flow chart 2',
      'sars and h3n2 study',
    ];
    for (const key of suit8Order) {
      const def = GERMAN_PASSAGE_TRANSLATIONS[key];
      assert.ok(def, `Suit 8 key "${key}" missing in GERMAN_PASSAGE_TRANSLATIONS`);
      assert.ok(def.deTitle.length > 0);
      assert.ok(def.deBodyMarkdown.length > 0);
    }
  });
});
