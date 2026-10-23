import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuestionTexts, extractQuestionImages } from '../../../lib/exam/question-helpers';

describe('ModuleQuestion helpers', () => {
  describe('cleanQuestionTexts', () => {
    it('returns question unchanged when context is undefined or empty', () => {
      assert.deepStrictEqual(cleanQuestionTexts(undefined, 'Which graph is correct?'), {
        context: undefined,
        question: 'Which graph is correct?',
      });

      assert.deepStrictEqual(cleanQuestionTexts('   ', 'Which graph is correct?'), {
        context: undefined,
        question: 'Which graph is correct?',
      });
    });

    it('returns empty question if question equals context', () => {
      assert.deepStrictEqual(cleanQuestionTexts('Same text', 'Same text'), {
        context: 'Same text',
        question: '',
      });
    });

    it('strips duplicate context from the start of question text', () => {
      const context = 'In the economy, more work often does not lead to linear profit:';
      const question = `${context}\n\nWhich of the following graphs correctly shows the increase?`;

      const result = cleanQuestionTexts(context, question);
      assert.strictEqual(result.context, context);
      assert.strictEqual(result.question, 'Which of the following graphs correctly shows the increase?');
    });

    it('preserves distinct context and question texts', () => {
      const context = 'Context text introduction.';
      const question = 'Which of the following statements is correct?';

      const result = cleanQuestionTexts(context, question);
      assert.strictEqual(result.context, 'Context text introduction.');
      assert.strictEqual(result.question, 'Which of the following statements is correct?');
    });
  });

  describe('extractQuestionImages', () => {
    it('prefers resolved_image_urls if populated', () => {
      const content = {
        resolved_image_urls: ['https://example.com/res1.webp', 'https://example.com/res2.webp'],
        question_image: 'https://example.com/raw1.webp',
        question_image_2: 'https://example.com/raw2.webp',
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, [
        'https://example.com/res1.webp',
        'https://example.com/res2.webp',
      ]);
    });

    it('extracts multi-image question keys in order', () => {
      const content = {
        question_image: 'https://example.com/img_main.webp',
        question_image_2: 'https://example.com/img_2.webp',
        question_image_3: 'https://example.com/img_3.webp',
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, [
        'https://example.com/img_main.webp',
        'https://example.com/img_2.webp',
        'https://example.com/img_3.webp',
      ]);
    });

    it('extracts 3D and options graphics (question_image_a, b, o)', () => {
      const content = {
        question_image_a: 'https://example.com/front.webp',
        question_image_b: 'https://example.com/side.webp',
        question_image_o: 'https://example.com/options.webp',
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, [
        'https://example.com/front.webp',
        'https://example.com/side.webp',
        'https://example.com/options.webp',
      ]);
    });

    it('extracts and deduplicates question_images array', () => {
      const content = {
        question_image: 'https://example.com/first.webp',
        question_images: [
          'https://example.com/first.webp',
          'https://example.com/second.webp',
          'https://example.com/third.webp',
        ],
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, [
        'https://example.com/first.webp',
        'https://example.com/second.webp',
        'https://example.com/third.webp',
      ]);
    });

    it('falls back to image_url or image when question_image is absent', () => {
      const content = {
        image_url: 'https://example.com/legacy.webp',
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, ['https://example.com/legacy.webp']);
    });

    it('falls back to passage_image_url when no question_image is present', () => {
      const content = {
        passage_image_url: 'https://example.com/passage_fallback.webp',
      };

      const images = extractQuestionImages(content);
      assert.deepStrictEqual(images, ['https://example.com/passage_fallback.webp']);
    });
  });
});
