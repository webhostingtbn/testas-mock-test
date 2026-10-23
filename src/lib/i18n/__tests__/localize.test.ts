import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  localizeExamData,
  findTranslationIssues,
} from '../localize';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('localizeExamData and findTranslationIssues', () => {
  it('1. en returns rows equal to input minus translations', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'What is TestAS?',
            options: [
              { id: 'opt_a', text: 'An aptitude test' },
              { id: 'opt_b', text: 'A programming language' },
            ],
          },
          translations: {
            de: {
              question_text: 'Was ist TestAS?',
              options: { opt_a: 'Ein Eignungstest' },
            },
          },
        },
      ],
      sections: [
        {
          id: 's1',
          title: 'Core Test',
          translations: { de: { title: 'Kerntest' } },
        },
      ],
      passages: [
        {
          id: 'p1',
          title: 'Reading passage',
          translations: { de: { title: 'Lesetext' } },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'en');

    assert.equal(localized.questions?.[0].content.question_text, 'What is TestAS?');
    assert.equal(localized.questions?.[0].content.options[0].text, 'An aptitude test');
    assert.equal('translations' in (localized.questions?.[0] ?? {}), false);
    assert.equal('translations' in (localized.sections?.[0] ?? {}), false);
    assert.equal('translations' in (localized.passages?.[0] ?? {}), false);
  });

  it('2. de full translation replaces question_text and all option texts', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'What is 2 + 2?',
            options: [
              { id: 'A', text: 'Three' },
              { id: 'B', text: 'Four' },
            ],
          },
          translations: {
            de: {
              question_text: 'Was ist 2 + 2?',
              options: {
                A: 'Drei',
                B: 'Vier',
              },
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.equal(localized.questions?.[0].content.question_text, 'Was ist 2 + 2?');
    assert.deepEqual(localized.questions?.[0].content.options, [
      { id: 'A', text: 'Drei' },
      { id: 'B', text: 'Vier' },
    ]);
    assert.equal('translations' in (localized.questions?.[0] ?? {}), false);
  });

  it('3. partial options map -> missing option keeps English text, array order and length unchanged', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'Select the odd one out:',
            options: [
              { id: 'opt_1', text: 'Apple' },
              { id: 'opt_2', text: 'Banana' },
              { id: 'opt_3', text: 'Carrot' },
            ],
          },
          translations: {
            de: {
              question_text: 'Wählen Sie das unpassende Element:',
              options: {
                opt_1: 'Apfel',
                // opt_2 is missing
                opt_3: 'Karotte',
              },
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.equal(localized.questions?.[0].content.options.length, 3);
    assert.equal(localized.questions?.[0].content.options[0].text, 'Apfel');
    assert.equal(localized.questions?.[0].content.options[1].text, 'Banana');
    assert.equal(localized.questions?.[0].content.options[2].text, 'Karotte');
  });

  it('4. record-shaped options are localized by key', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'Pick one',
            options: {
              A: 'Yes',
              B: 'No',
            },
          },
          translations: {
            de: {
              options: {
                A: 'Ja',
                B: 'Nein',
              },
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.deepEqual(localized.questions?.[0].content.options, {
      A: 'Ja',
      B: 'Nein',
    });
  });

  it('5. unknown option id in translation is ignored by localize, reported by findTranslationIssues', () => {
    const baseQuestion = {
      id: 'q1',
      content: {
        question_text: 'Question prompt',
        options: [{ id: 'A', text: 'Option A' }],
      },
    };

    const translation = {
      question_text: 'Fragetext',
      options: {
        A: 'Option A Deutsch',
        Z_UNKNOWN: 'Ghost option',
      },
    };

    const bundle = {
      questions: [
        {
          ...baseQuestion,
          translations: { de: translation },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.deepEqual(localized.questions?.[0].content.options, [{ id: 'A', text: 'Option A Deutsch' }]);

    const issues = findTranslationIssues('question', baseQuestion, translation);
    assert.equal(issues.some((i) => i.includes('Z_UNKNOWN')), true);
  });

  it('6. question_image override applies; absent override keeps base image', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'Look at the diagram',
            question_image: 'https://cdn.example.com/en-diagram.png',
          },
          translations: {
            de: {
              question_image: 'https://cdn.example.com/de-diagram.png',
            },
          },
        },
        {
          id: 'q2',
          content: {
            question_text: 'Look at this other diagram',
            question_image: 'https://cdn.example.com/base-image.png',
          },
          translations: {
            de: {
              question_text: 'Schauen Sie sich dieses andere Diagramm an',
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.equal(localized.questions?.[0].content.question_image, 'https://cdn.example.com/de-diagram.png');
    assert.equal(localized.questions?.[1].content.question_image, 'https://cdn.example.com/base-image.png');
  });

  it('7. non-verbal question (figure_sequence content, no translations) is returned unchanged apart from stripping', () => {
    const bundle = {
      questions: [
        {
          id: 'q_fig',
          question_type: 'figure_sequence',
          content: {
            sequence_images: ['s1.svg', 's2.svg'],
            answer_options: ['a.svg', 'b.svg'],
          },
          translations: {},
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    assert.deepEqual(localized.questions?.[0].content, {
      sequence_images: ['s1.svg', 's2.svg'],
      answer_options: ['a.svg', 'b.svg'],
    });
    assert.equal('translations' in (localized.questions?.[0] ?? {}), false);
  });

  it('8. passage and section overrides, including environment_content merge', () => {
    const bundle = {
      sections: [
        {
          id: 's1',
          title: 'Economics Environmental Section',
          description: 'Base description',
          environment_content: {
            text: 'Base environment context',
            images: ['table1.webp'],
          },
          translations: {
            de: {
              title: 'Wirtschaft Umweltteil',
              description: 'Deutsche Beschreibung',
              environment_content: {
                text: 'Deutscher Umweltkontext',
              },
            },
          },
        },
      ],
      passages: [
        {
          id: 'p1',
          title: 'Base Title',
          body_markdown: 'English markdown body',
          image_url: 'https://cdn.example.com/eng.png',
          translations: {
            de: {
              title: 'Deutscher Titel',
              body_markdown: 'Deutscher Markdown-Text',
              image_url: 'https://cdn.example.com/de.png',
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');

    const sec = localized.sections?.[0];
    assert.equal(sec?.title, 'Wirtschaft Umweltteil');
    assert.equal(sec?.description, 'Deutsche Beschreibung');
    assert.deepEqual(sec?.environment_content, {
      text: 'Deutscher Umweltkontext',
      images: ['table1.webp'],
    });

    const pass = localized.passages?.[0];
    assert.equal(pass?.title, 'Deutscher Titel');
    assert.equal(pass?.body_markdown, 'Deutscher Markdown-Text');
    assert.equal(pass?.image_url, 'https://cdn.example.com/de.png');
  });

  it('falls back to English when German environment_content.text is empty or whitespace', () => {
    const bundleWithEmptyEnv = {
      sections: [
        {
          id: 's2',
          title: 'Section 2',
          environment_content: { text: 'English text', images: ['img1.png'] },
          translations: {
            de: {
              environment_content: { text: '' }, // empty string fallback
            },
          },
        },
        {
          id: 's3',
          title: 'Section 3',
          environment_content: { text: 'English text 3', images: ['img2.png'] },
          translations: {
            de: {
              environment_content: { text: '   ', images: [] }, // whitespace and empty images fallback
            },
          },
        },
      ],
    };
    const localizedEmpty = localizeExamData(bundleWithEmptyEnv, 'de');
    assert.deepEqual(localizedEmpty.sections?.[0].environment_content, {
      text: 'English text',
      images: ['img1.png'],
    });
    assert.deepEqual(localizedEmpty.sections?.[1].environment_content, {
      text: 'English text 3',
      images: ['img2.png'],
    });
  });

  it('9. _source_hash never appears in output', () => {
    const bundle = {
      questions: [
        {
          id: 'q1',
          content: { question_text: 'English' },
          translations: {
            de: {
              question_text: 'Deutsch',
              _source_hash: 'abc123hash',
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    const jsonStr = JSON.stringify(localized);
    assert.equal(jsonStr.includes('_source_hash'), false);
    assert.equal(jsonStr.includes('abc123hash'), false);
  });

  it('11. splits German combined question_text when base had context_text', () => {
    const bundle = {
      questions: [
        {
          id: 'q_econ_20',
          content: {
            context_text: 'In the economy, more work often does not lead to linear profit.',
            question_text: 'Which of the following graphs correctly shows the increase?',
            question_image: 'https://cdn.example.com/20a.webp',
            question_image_2: 'https://cdn.example.com/20b.webp',
            options: [
              { id: 'A', text: 'Graph A' },
              { id: 'B', text: 'Graph B' },
            ],
          },
          translations: {
            de: {
              question_text: 'In der Wirtschaft führt mehr Arbeit oft nicht zu linearem Gewinn.\n\nWelcher der folgenden Graphen zeigt die Steigerung korrekt?',
              options: {
                A: 'Graph A (DE)',
                B: 'Graph B (DE)',
              },
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    const qContent = localized.questions?.[0].content as Record<string, unknown>;

    assert.equal(qContent.context_text, 'In der Wirtschaft führt mehr Arbeit oft nicht zu linearem Gewinn.');
    assert.equal(qContent.question_text, 'Welcher der folgenden Graphen zeigt die Steigerung korrekt?');
    // question_image_2 is preserved from base
    assert.equal(qContent.question_image_2, 'https://cdn.example.com/20b.webp');
  });

  it('12. respects explicit context_text and multi-image translation overrides', () => {
    const bundle = {
      questions: [
        {
          id: 'q_multi',
          content: {
            context_text: 'Base context',
            question_text: 'Base question',
            question_image_a: 'https://cdn.example.com/a.webp',
            question_image_b: 'https://cdn.example.com/b.webp',
          },
          translations: {
            de: {
              context_text: 'Deutscher Kontext',
              question_text: 'Deutsche Frage',
              question_image_a: 'https://cdn.example.com/a_de.webp',
            },
          },
        },
      ],
    };

    const localized = localizeExamData(bundle, 'de');
    const qContent = localized.questions?.[0].content as Record<string, unknown>;

    assert.equal(qContent.context_text, 'Deutscher Kontext');
    assert.equal(qContent.question_text, 'Deutsche Frage');
    assert.equal(qContent.question_image_a, 'https://cdn.example.com/a_de.webp');
    assert.equal(qContent.question_image_b, 'https://cdn.example.com/b.webp');
  });

  it('10. input objects are not mutated (deep-freeze input)', () => {
    const bundle = deepFreeze({
      questions: [
        {
          id: 'q1',
          content: {
            question_text: 'Immutable question',
            options: [{ id: 'A', text: 'English A' }],
          },
          translations: {
            de: {
              question_text: 'Unveränderliche Frage',
              options: { A: 'Deutsch A' },
            },
          },
        },
      ],
      sections: [
        {
          id: 's1',
          title: 'Section 1',
          environment_content: { text: 'Env text' },
          translations: {
            de: {
              title: 'Abschnitt 1',
              environment_content: { text: 'Umwelttext' },
            },
          },
        },
      ],
      passages: [
        {
          id: 'p1',
          title: 'Passage 1',
          body_markdown: 'Markdown',
          translations: {
            de: { title: 'Text 1' },
          },
        },
      ],
    });

    // Should not throw on frozen object
    const localized = localizeExamData(bundle, 'de');
    assert.equal(localized.questions?.[0].content.question_text, 'Unveränderliche Frage');
    assert.equal(localized.sections?.[0].title, 'Abschnitt 1');
  });

  it('findTranslationIssues detects validation problems', () => {
    // Non-object translation
    assert.deepEqual(findTranslationIssues('question', {}, 'not an object'), ['Translation must be an object']);

    // Unknown keys
    const unknownKeyIssues = findTranslationIssues(
      'question',
      { content: { question_text: 'Hi' } },
      { question_text: 'Hallo', invalid_extra: 'boom' },
    );
    assert.equal(unknownKeyIssues.some((i) => i.includes('invalid_extra')), true);

    // Empty text when base has text
    const emptyIssues = findTranslationIssues(
      'question',
      { content: { question_text: 'Hi' } },
      { question_text: '   ' },
    );
    assert.equal(emptyIssues.some((i) => i.includes('cannot be empty')), true);

    // Missing required fields when base has text
    const missingQText = findTranslationIssues(
      'question',
      { content: { question_text: 'Hi' } },
      { options: { A: 'A' } },
    );
    assert.equal(missingQText.some((i) => i.includes('question_text is required when base has text')), true);

    const missingOptionText = findTranslationIssues(
      'question',
      {
        content: {
          question_text: 'What is X?',
          options: [
            { id: 'A', text: 'Option A' },
            { id: 'B', text: 'Option B' },
          ],
        },
      },
      {
        question_text: 'Was ist X?',
        options: { A: 'Option A (DE)' },
      },
    );
    assert.equal(missingOptionText.some((i) => i.includes('Option "B" is required when base has text')), true);

    const emptyOptionText = findTranslationIssues(
      'question',
      {
        content: {
          question_text: 'What is X?',
          options: { A: 'Option A' },
        },
      },
      {
        question_text: 'Was ist X?',
        options: { A: '   ' },
      },
    );
    assert.equal(emptyOptionText.some((i) => i.includes('Option "A" cannot be empty when base has text')), true);

    const missingPassageTitle = findTranslationIssues(
      'passage',
      { title: 'Passage Title', body_markdown: 'Body' },
      { body_markdown: 'Deutscher Text' },
    );
    assert.equal(missingPassageTitle.some((i) => i.includes('title is required when base has text')), true);

    const missingPassageBody = findTranslationIssues(
      'passage',
      { body_markdown: 'Base markdown' },
      { title: 'Titel' },
    );
    assert.equal(missingPassageBody.some((i) => i.includes('body_markdown is required when base has text')), true);

    const missingSectionTitle = findTranslationIssues(
      'section',
      { title: 'Section Title', description: 'Desc' },
      { description: 'Deutsche Beschreibung' },
    );
    assert.equal(missingSectionTitle.some((i) => i.includes('title is required when base has text')), true);

    const missingSectionDesc = findTranslationIssues(
      'section',
      { description: 'Base description' },
      { title: 'Titel' },
    );
    assert.equal(missingSectionDesc.some((i) => i.includes('description is required when base has text')), true);

    const missingSectionEnv = findTranslationIssues(
      'section',
      { environment_content: { text: 'Base environment text' } },
      { title: 'Titel' },
    );
    assert.equal(missingSectionEnv.some((i) => i.includes('environment_content is required when base has text')), true);

    // Section environment_content not an object
    const envIssues = findTranslationIssues(
      'section',
      {},
      { environment_content: 'invalid string' },
    );
    assert.equal(envIssues.some((i) => i.includes('environment_content must be an object')), true);
  });
});
