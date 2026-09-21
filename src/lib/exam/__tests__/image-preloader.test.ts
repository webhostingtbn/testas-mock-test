import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuestionImageUrls } from '../image-preloader';

describe('extractQuestionImageUrls', () => {
  it('returns empty array when question is null or undefined', () => {
    assert.deepStrictEqual(extractQuestionImageUrls(null), []);
    assert.deepStrictEqual(extractQuestionImageUrls(undefined), []);
  });

  it('extracts prompt and option URLs for figure sequence questions', () => {
    const q = {
      id: 'fig-1',
      question_type: 'figure_sequence',
      content: {
        prompt_image_url: 'https://example.com/prompt.webp',
        options_urls: [
          'https://example.com/opt1.webp',
          'https://example.com/opt2.webp',
          'https://example.com/opt3.webp',
          'https://example.com/opt4.webp',
          'https://example.com/opt5.webp',
          'https://example.com/opt6.webp',
        ],
      },
    };

    const urls = extractQuestionImageUrls(q);
    assert.deepStrictEqual(urls, [
      'https://example.com/prompt.webp',
      'https://example.com/opt1.webp',
      'https://example.com/opt2.webp',
      'https://example.com/opt3.webp',
      'https://example.com/opt4.webp',
      'https://example.com/opt5.webp',
      'https://example.com/opt6.webp',
    ]);
  });

  it('extracts grid and options URLs for completing patterns questions', () => {
    const q = {
      id: 'pat-1',
      question_type: 'completing_patterns',
      content: {
        grid_image_url: 'https://example.com/grid.webp',
        options_image_url: 'https://example.com/options.webp',
      },
    };

    const urls = extractQuestionImageUrls(q);
    assert.deepStrictEqual(urls, [
      'https://example.com/grid.webp',
      'https://example.com/options.webp',
    ]);
  });

  it('extracts nested child question images for passage questions', () => {
    const passage = {
      id: 'passage-1',
      isPassage: true,
      content: {
        image_url: 'https://example.com/passage.webp',
      },
      questions: [
        {
          id: 'child-1',
          content: {
            image_url: 'https://example.com/child1.webp',
          },
        },
        {
          id: 'child-2',
          content: {
            image_url: 'https://example.com/child2.webp',
          },
        },
      ],
    };

    const urls = extractQuestionImageUrls(passage);
    assert.deepStrictEqual(urls, [
      'https://example.com/passage.webp',
      'https://example.com/child1.webp',
      'https://example.com/child2.webp',
    ]);
  });

  it('extracts passage_image_url, question_image, and resolved_image_url', () => {
    const q = {
      id: 'mcq-1',
      question_type: 'module_mcq',
      content: {
        passage_image_url: 'https://example.com/passage_banner.webp',
        question_image: 'https://example.com/diagram.webp',
        resolved_image_url: 'https://example.com/resolved_diagram.webp',
      },
    };

    const urls = extractQuestionImageUrls(q);
    assert.deepStrictEqual(urls, [
      'https://example.com/passage_banner.webp',
      'https://example.com/diagram.webp',
      'https://example.com/resolved_diagram.webp',
    ]);
  });

  it('deduplicates URLs and filters out plain text options', () => {
    const q = {
      id: 'mcq-2',
      question_type: 'module_mcq',
      content: {
        image_url: 'https://example.com/shared.png',
        options: [
          'Option A: Hydrogen',
          'Option B: Helium',
          'https://example.com/shared.png', // duplicate
          'https://example.com/choice.svg',
          'https://example.com/non-image-link',
        ],
      },
    };

    const urls = extractQuestionImageUrls(q);
    assert.deepStrictEqual(urls, [
      'https://example.com/shared.png',
      'https://example.com/choice.svg',
    ]);
  });
});

