/**
 * Helper utilities for exam question text formatting and image extraction.
 */

export interface QuestionTexts {
  context?: string;
  question: string;
}

/**
 * Normalizes and separates context text and question text.
 * If question_text duplicates context_text at the start, it removes the redundancy.
 */
export function cleanQuestionTexts(rawContext?: string, rawQuestion?: string): QuestionTexts {
  const context = typeof rawContext === 'string' ? rawContext.trim() : '';
  const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : '';

  if (!context) {
    return { context: undefined, question };
  }

  if (!question) {
    return { context, question: '' };
  }

  if (question === context) {
    return { context, question: '' };
  }

  if (question.startsWith(context)) {
    const remainder = question.slice(context.length).replace(/^[\s\r\n]+/, '');
    return { context, question: remainder };
  }

  return { context, question };
}

/**
 * Extracts all candidate question images in order:
 * 1. resolved_image_urls (if populated by ImageService)
 * 2. question_image, question_image_2, question_image_3
 * 3. question_image_a, question_image_b, question_image_o
 * 4. question_images array
 * 5. resolved_image_url, image_url, image fallbacks
 */
export function extractQuestionImages(content: Record<string, unknown>): string[] {
  if (Array.isArray(content.resolved_image_urls) && content.resolved_image_urls.length > 0) {
    const urls = content.resolved_image_urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '');
    if (urls.length > 0) return urls;
  }

  const images: string[] = [];
  const addIfValid = (val: unknown) => {
    if (typeof val === 'string' && val.trim() !== '') {
      const trimmed = val.trim();
      if (!images.includes(trimmed)) {
        images.push(trimmed);
      }
    }
  };

  addIfValid(content.question_image);
  addIfValid(content.question_image_2);
  addIfValid(content.question_image_3);
  addIfValid(content.question_image_a);
  addIfValid(content.question_image_b);
  addIfValid(content.question_image_o);

  if (Array.isArray(content.question_images)) {
    for (const item of content.question_images) {
      addIfValid(item);
    }
  }

  addIfValid(content.resolved_image_url);
  addIfValid(content.image_url);
  addIfValid(content.image);

  return images;
}
