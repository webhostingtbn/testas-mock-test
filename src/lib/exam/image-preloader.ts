export interface QuestionWithContent {
  id?: string;
  question_type?: string;
  content?: unknown;
  isPassage?: boolean;
  questions?: QuestionWithContent[];
}

function isLikelyImageUrl(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  if (val.startsWith('blob:') || val.startsWith('data:image/')) return true;
  if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('/')) return false;
  return (
    /\.(webp|png|jpe?g|svg|gif|avif)($|\?)/i.test(val) ||
    val.includes('/storage/v1/object/') ||
    val.includes('/images/')
  );
}

/**
 * Extracts all candidate image URLs from any question object,
 * including Figure Sequence, Completing Patterns, and passage questions.
 */
export function extractQuestionImageUrls(q: QuestionWithContent | null | undefined): string[] {
  if (!q) return [];
  const urls: string[] = [];
  const content: Record<string, unknown> =
    q.content && typeof q.content === 'object' && !Array.isArray(q.content)
      ? (q.content as Record<string, unknown>)
      : {};

  // prompt_image / prompt_image_url (Figure Sequence)
  if (typeof content.prompt_image_url === 'string' && content.prompt_image_url) {
    urls.push(content.prompt_image_url);
  } else if (typeof content.prompt_image === 'string' && content.prompt_image) {
    urls.push(content.prompt_image);
  }

  // grid_image_url / options_image_url (Completing Patterns)
  if (typeof content.grid_image_url === 'string' && content.grid_image_url) {
    urls.push(content.grid_image_url);
  }
  if (typeof content.options_image_url === 'string' && content.options_image_url) {
    urls.push(content.options_image_url);
  }

  // image_url / image (Standard MCQ & Module questions)
  if (typeof content.image_url === 'string' && content.image_url) {
    urls.push(content.image_url);
  } else if (typeof content.image === 'string' && content.image) {
    urls.push(content.image);
  }

  // passage_image_url / question_image / resolved_image_url (Module MCQ & passages)
  if (typeof content.passage_image_url === 'string' && content.passage_image_url) {
    urls.push(content.passage_image_url);
  }
  if (typeof content.question_image === 'string' && content.question_image) {
    urls.push(content.question_image);
  }
  if (typeof content.resolved_image_url === 'string' && content.resolved_image_url) {
    urls.push(content.resolved_image_url);
  }

  // options_urls (Figure Sequence array of signed URLs)
  if (Array.isArray(content.options_urls)) {
    content.options_urls.forEach((u) => {
      if (typeof u === 'string' && u) urls.push(u);
    });
  }

  // options array (string URLs or objects with image/image_url)
  if (Array.isArray(content.options)) {
    content.options.forEach((opt) => {
      if (typeof opt === 'string' && isLikelyImageUrl(opt)) {
        urls.push(opt);
      } else if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
        const optObj = opt as Record<string, unknown>;
        if (typeof optObj.image_url === 'string' && optObj.image_url) urls.push(optObj.image_url);
        if (typeof optObj.image === 'string' && optObj.image) urls.push(optObj.image);
      }
    });
  }

  // Nested passage child questions
  if (Array.isArray(q.questions)) {
    q.questions.forEach((childQ) => {
      urls.push(...extractQuestionImageUrls(childQ));
    });
  }

  return Array.from(new Set(urls));
}

/**
 * Preloads a single image into browser memory cache.
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) {
      resolve();
      return;
    }
    const img = new Image();
    img.src = url;
    if (img.complete) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

/**
 * Preloads all images for a question with a safety timeout to prevent stalling.
 */
export async function preloadQuestionImages(
  q: QuestionWithContent | null | undefined,
  timeoutMs = 2500,
): Promise<void> {
  if (!q) return;
  const urls = extractQuestionImageUrls(q);
  if (urls.length === 0) return;

  const preloadPromise = Promise.all(urls.map((u) => preloadImage(u)));
  await Promise.race([
    preloadPromise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
