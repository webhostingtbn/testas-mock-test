import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImageService } from '../../services/image-service';

describe('ImageService - image separation', () => {
  const imageService = new ImageService();

  it('does NOT copy passage_image_url into question resolved_image_url', async () => {
    const questionContent = {
      question_text: 'What is shown in the passage?',
      passage_title: 'Fibonacci Spiral',
      passage_markdown: 'The spiral shows...',
      passage_image_url: 'https://example.com/fibonacci.webp',
      options: {
        A: 'Option 1',
        B: 'Option 2',
      },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    // passage_image_url must remain intact
    assert.strictEqual(resolved.passage_image_url, 'https://example.com/fibonacci.webp');
    // resolved_image_url must NOT be set to the passage image
    assert.strictEqual(resolved.resolved_image_url, undefined);
  });

  it('sets resolved_image_url from question_image when present', async () => {
    const questionContent = {
      question_text: 'Refer to the diagram below:',
      passage_title: 'Macroeconomics',
      passage_markdown: 'Economic text...',
      passage_image_url: 'https://example.com/passage_macro.webp',
      question_image: 'https://example.com/eco_graph.webp',
      options: {
        A: 'Demand curve',
        B: 'Supply curve',
      },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    // passage_image_url stays intact
    assert.strictEqual(resolved.passage_image_url, 'https://example.com/passage_macro.webp');
    // question_image is surfaced as resolved_image_url
    assert.strictEqual(resolved.resolved_image_url, 'https://example.com/eco_graph.webp');
  });

  it('preserves child questions vs passage images in resolveQuestionImageUrls', async () => {
    const questions = [
      {
        id: 'q-1',
        section_id: 'sec-1',
        sort_order: 1,
        question_type: 'module_mcq',
        content: {
          question_text: 'Question 1 text',
          passage_title: 'Passage Ref',
          passage_markdown: 'Markdown content',
          passage_image_url: 'https://example.com/passage_img.webp',
          options: { A: 'A', B: 'B' },
        },
      },
    ];

    const resolved = await imageService.resolveQuestionImageUrls(questions);
    assert.ok(resolved.length > 0, 'Resolved array must not be empty');
    const firstQ = resolved[0];
    assert.ok(firstQ, 'First question must be defined');
    assert.ok(firstQ.content && typeof firstQ.content === 'object' && !Array.isArray(firstQ.content), 'Content must be an object');
    const content = firstQ.content as Record<string, unknown>;

    assert.strictEqual(content.passage_image_url, 'https://example.com/passage_img.webp');
    assert.strictEqual(content.resolved_image_url, undefined);
  });
});
