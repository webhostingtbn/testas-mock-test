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

  it('collects question_image and question_image_2 into resolved_image_urls in order', async () => {
    const questionContent = {
      context_text: 'Context introductory text...',
      question_text: 'Which of the following graphs correctly shows...',
      question_image: 'https://example.com/graph_a.webp',
      question_image_2: 'https://example.com/graph_b.webp',
      options: {
        A: 'Graph A',
        B: 'Graph B',
      },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    assert.strictEqual(resolved.resolved_image_url, 'https://example.com/graph_a.webp');
    assert.deepStrictEqual(resolved.resolved_image_urls, [
      'https://example.com/graph_a.webp',
      'https://example.com/graph_b.webp',
    ]);
  });

  it('supports eng_2_3d question_image_a and question_image_b', async () => {
    const questionContent = {
      question_text: 'Here you see the cube from the front...',
      question_image_a: 'https://example.com/cube_front.webp',
      question_image_b: 'https://example.com/cube_angle.webp',
      options: { A: 'Right', B: 'Left' },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    assert.strictEqual(resolved.resolved_image_url, 'https://example.com/cube_front.webp');
    assert.deepStrictEqual(resolved.resolved_image_urls, [
      'https://example.com/cube_front.webp',
      'https://example.com/cube_angle.webp',
    ]);
  });

  it('supports eng_3 question_image and question_image_o (options graphic)', async () => {
    const questionContent = {
      question_text: 'The graphic below shows acceleration...',
      question_image: 'https://example.com/accel.webp',
      question_image_o: 'https://example.com/options_graph.webp',
      options: { A: 'A', B: 'B' },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    assert.strictEqual(resolved.resolved_image_url, 'https://example.com/accel.webp');
    assert.deepStrictEqual(resolved.resolved_image_urls, [
      'https://example.com/accel.webp',
      'https://example.com/options_graph.webp',
    ]);
  });

  it('supports question_images array and deduplicates identical paths', async () => {
    const questionContent = {
      question_text: 'Multiple images array test',
      question_image: 'https://example.com/img1.webp',
      question_images: ['https://example.com/img1.webp', 'https://example.com/img2.webp'],
      options: { A: 'A', B: 'B' },
    };

    const resolved = await imageService.resolveImageUrls(questionContent);

    assert.strictEqual(resolved.resolved_image_url, 'https://example.com/img1.webp');
    assert.deepStrictEqual(resolved.resolved_image_urls, [
      'https://example.com/img1.webp',
      'https://example.com/img2.webp',
    ]);
  });
});
