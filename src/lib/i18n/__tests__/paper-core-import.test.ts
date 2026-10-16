import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  sanitizeSql,
  parsePaperCoreSql,
  extractOptionLetter,
  remapOptionsToDatabaseRow,
  normalizeQuestionStem,
  getOptionMatchScore,
} from '../../../../scripts/import-paper-core-translations';

describe('PaperCore German Importer Unit Tests', () => {
  it('1. sanitizeSql normalizes non-breaking spaces and line endings', () => {
    const raw = 'Hello\u00A0World\r\nLine 2';
    const sanitized = sanitizeSql(raw);
    assert.equal(sanitized, 'Hello World\nLine 2');
    assert.equal(sanitized.includes('\u00A0'), false);
  });

  it('2. parsePaperCoreSql handles $$ and $q$ delimiters and strips placeholder images', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-paper-core-'));
    const testSqlPath = path.join(tmpDir, 'test.sql');

    const sqlContent = `
    VALUES
    (1, $$
    {
      "question_text": "Question 1 text with $math = 5$",
      "question_image": "REPLACE_WITH_QUESTION_IMAGE_URL",
      "options": [
        { "id": "q1_1_A", "text": "Option A" },
        { "id": "q1_1_B", "text": "Option B" }
      ]
    }
    $$, '"A"'),
    (2, $q$
    {
      "question_text": "Question 2 text",
      "question_image": "https://cdn.example.com/diagram.webp",
      "options": [
        { "id": "A", "text": "Choice A" },
        { "id": "B", "text": "Choice B" }
      ]
    }
    }
    $q$, '"B"')
    `;

    fs.writeFileSync(testSqlPath, sqlContent, 'utf-8');

    const parsed = parsePaperCoreSql(testSqlPath);
    assert.equal(parsed.length, 2);

    // Question 1
    assert.equal(parsed[0].sortOrder, 1);
    assert.equal(parsed[0].questionText, 'Question 1 text with $math = 5$');
    assert.equal(parsed[0].questionImage, undefined); // Placeholder filtered out
    assert.equal(parsed[0].options.length, 2);
    assert.equal(parsed[0].options[0].id, 'q1_1_A');
    assert.equal(parsed[0].correctAnswer, 'A');

    // Question 2 (with $q$ and stray closing brace)
    assert.equal(parsed[1].sortOrder, 2);
    assert.equal(parsed[1].questionText, 'Question 2 text');
    assert.equal(parsed[1].questionImage, 'https://cdn.example.com/diagram.webp');
    assert.equal(parsed[1].options.length, 2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('3. extractOptionLetter handles prefixed, suffixed, and bare IDs', () => {
    assert.equal(extractOptionLetter('A', 0), 'A');
    assert.equal(extractOptionLetter('q1_1_A', 0), 'A');
    assert.equal(extractOptionLetter('opt_D', 3), 'D');
    assert.equal(extractOptionLetter('E', 4), 'E');
    assert.equal(extractOptionLetter('unknown', 2), 'C'); // fallback to index
  });

  it('4. remapOptionsToDatabaseRow remaps prefixed options to base DB option IDs', () => {
    const baseContent = {
      options: [
        { id: 'A', text: 'Base text A' },
        { id: 'B', text: 'Base text B' },
        { id: 'C', text: 'Base text C' },
        { id: 'D', text: 'Base text D' },
      ],
    };

    const gerOptions = [
      { id: 'q1_1_A', text: 'Deutscher Text A' },
      { id: 'q1_1_B', text: 'Deutscher Text B' },
      { id: 'q1_1_C', text: 'Deutscher Text C' },
      { id: 'q1_1_D', text: 'Deutscher Text D' },
    ];

    const remapped = remapOptionsToDatabaseRow(baseContent, gerOptions);
    assert.deepEqual(remapped, {
      A: 'Deutscher Text A',
      B: 'Deutscher Text B',
      C: 'Deutscher Text C',
      D: 'Deutscher Text D',
    });
  });

  it('5. remapOptionsToDatabaseRow supports 5-option questions (A-E)', () => {
    const baseContent = {
      options: [
        { id: 'A', text: 'wood' },
        { id: 'B', text: 'leaf' },
        { id: 'C', text: 'root' },
        { id: 'D', text: 'forest' },
        { id: 'E', text: 'branch' },
      ],
    };

    const gerOptions = [
      { id: 'A', text: 'Holz' },
      { id: 'B', text: 'Blatt' },
      { id: 'C', text: 'Wurzel' },
      { id: 'D', text: 'Wald' },
      { id: 'E', text: 'Zweig' },
    ];

    const remapped = remapOptionsToDatabaseRow(baseContent, gerOptions);
    assert.deepEqual(remapped, {
      A: 'Holz',
      B: 'Blatt',
      C: 'Wurzel',
      D: 'Wald',
      E: 'Zweig',
    });
  });

  it('6. normalizeQuestionStem strips question numbering prefixes and normalizes carets/punctuation', () => {
    assert.equal(
      normalizeQuestionStem('1.1 Tina goes on vacation  '),
      'tina goes on vacation'
    );
    assert.equal(
      normalizeQuestionStem('  22  What is the area? '),
      'what is the area?'
    );
    assert.equal(
      normalizeQuestionStem('chair: to sit - _______ : _______'),
      'chair : to sit - ______ : ______'
    );
    // Gas tank exponent matching
    assert.equal(
      normalizeQuestionStem('1.8 Speed of 10 m^3 per minute'),
      normalizeQuestionStem('Speed of 10 m3 per minute')
    );
    // Carpentry tile exponent matching
    assert.equal(
      normalizeQuestionStem('1.9 Area of 50 m^2 in a house'),
      normalizeQuestionStem('Area of 50 m2 in a house')
    );
    // Inferring relationships spacing matching
    assert.equal(
      normalizeQuestionStem('________ : ________= calm : quiet'),
      normalizeQuestionStem('________ : ________ = calm : quiet')
    );
  });

  it('7. getOptionMatchScore scores candidate options against source question options', () => {
    const candidateA = {
      options: [
        { id: 'A', text: 'Scream - Cry' },
        { id: 'B', text: 'Walk - Run' },
        { id: 'C', text: 'Luck - Joy' },
        { id: 'D', text: 'Sad - Console' },
      ],
    };

    const candidateB = {
      options: [
        { id: 'A', text: 'scream - cry' },
        { id: 'B', text: 'walk - run' },
        { id: 'C', text: 'Happiness - Joy' },
        { id: 'D', text: 'sad - comfort' },
      ],
    };

    const engOptionsA = [
      { id: 'A', text: 'Scream - Cry' },
      { id: 'B', text: 'Walk - Run' },
      { id: 'C', text: 'Luck - Joy' },
      { id: 'D', text: 'Sad - Console' },
    ];

    assert.equal(getOptionMatchScore(candidateA, engOptionsA), 4);
    assert.equal(getOptionMatchScore(candidateB, engOptionsA), 2);

    const engOptionsB = [
      { id: 'A', text: 'scream - cry' },
      { id: 'B', text: 'walk - run' },
      { id: 'C', text: 'Happiness - Joy' },
      { id: 'D', text: 'sad - comfort' },
    ];

    assert.equal(getOptionMatchScore(candidateA, engOptionsB), 2);
    assert.equal(getOptionMatchScore(candidateB, engOptionsB), 4);
  });
});


