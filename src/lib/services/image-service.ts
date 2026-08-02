'use client';

/**
 * ImageService - Resolves asset URLs via server-signed API (/api/storage/sign)
 */
type ImageContent = Record<string, unknown>;

interface ImageQuestion {
  [key: string]: unknown;
  content?: ImageContent;
  questions?: ImageQuestion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export class ImageService {
  /**
   * Resolves a single image path to a signed short-lived URL
   */
  async resolveImageUrl(path: string | null | undefined): Promise<string | undefined> {
    if (!path) return undefined;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const publicStoragePrefix = supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/ExamDataset/`
      : null;
    if (publicStoragePrefix && path.startsWith(publicStoragePrefix)) {
      try {
        return this.resolveImageUrl(decodeURIComponent(path.slice(publicStoragePrefix.length)));
      } catch {
        return undefined;
      }
    }

    if (path.startsWith('http') || path.startsWith('/')) {
      return path;
    }

    try {
      const res = await fetch(`/api/storage/sign?path=${encodeURIComponent(path)}`);
      if (!res.ok) return undefined;
      const data = await res.json();
      return data.signedUrl;
    } catch (error) {
      console.error(`Failed to resolve image URL for path: ${path}`, error);
      return undefined;
    }
  }

  async resolveImageUrls(content: ImageContent): Promise<ImageContent> {

    const newContent = { ...content };

    const promptImage = asString(content.prompt_image);
    if (promptImage) {
      const resolved = await this.resolveImageUrl(promptImage);
      if (resolved) {
        newContent.prompt_image_url = resolved;
      }
    }

    if (Array.isArray(content.options)) {
      const optionsUrls = await Promise.all(
        content.options.map(async (option: unknown) => {
          const path = typeof option === 'string'
            ? option
            : isRecord(option)
              ? asString(option.image) || asString(option.path)
              : undefined;
          if (!path) return undefined;
          const resolved = await this.resolveImageUrl(path);
          return resolved || path;
        })
      );
      newContent.options_urls = optionsUrls;
    }

    const gridImage = asString(content.grid_image);
    if (gridImage) {
      const resolved = await this.resolveImageUrl(gridImage);
      if (resolved) {
        newContent.grid_image_url = resolved;
      }
    }

    const optionsImage = asString(content.options_image);
    if (optionsImage) {
      const resolved = await this.resolveImageUrl(optionsImage);
      if (resolved) {
        newContent.options_image_url = resolved;
      }
    }

    const questionImage = asString(content.question_image);
    if (questionImage) {
      const resolved = await this.resolveImageUrl(questionImage);
      if (resolved) {
        newContent.question_image = resolved;
      }
    }

    const imageUrl = asString(content.image_url);
    if (imageUrl) {
      const resolved = await this.resolveImageUrl(imageUrl);
      if (resolved) {
        newContent.image_url = resolved;
      }
    }

    return newContent;
  }

  async resolveQuestionImageUrls(questions: ImageQuestion[]): Promise<ImageQuestion[]> {
    return Promise.all(
      questions.map(async (question) => {
        const resolvedChildren = Array.isArray(question.questions)
          ? await this.resolveQuestionImageUrls(question.questions)
          : undefined;
        if (!question.content && !resolvedChildren) return question;
        return {
          ...question,
          ...(question.content ? { content: await this.resolveImageUrls(question.content) } : {}),
          ...(resolvedChildren ? { questions: resolvedChildren } : {}),
        };
      })
    );
  }
}
