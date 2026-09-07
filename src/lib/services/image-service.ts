'use client';

/**
 * ImageService - Resolves asset URLs via server-signed API (/api/storage/sign)
 *
 * Single place that knows which fields are image paths:
 * - Question content: prompt/grid/options/question images (+ passage image when embedded)
 * - Passage top-level: `image_url` -> `resolved_image_url` (what ModuleMCQ renders)
 */
type ImageContent = Record<string, unknown>;

interface QuestionLike {
  content?: unknown;
  questions?: QuestionLike[];
}

function asQuestionArray(value: unknown): QuestionLike[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as QuestionLike[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isBareStoragePath(value: string): boolean {
  return value.length > 0 && !value.startsWith('http') && !value.startsWith('/') && !value.startsWith('data:');
}

/** How long a signed URL is trusted before re-signing (Supabase signatures are short-lived). */
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;

export class ImageService {
  private readonly signedCache = new Map<string, { url: string; expiresAt: number }>();
  private readonly inFlightSigns = new Map<string, Promise<string | undefined>>();

  /**
   * Resolves a single image path to a signed short-lived URL.
   * Absolute URLs (http//) pass through untouched. Cached signatures are
   * re-requested after TTL so lingering on a question can't 403.
   */
  async resolveImageUrl(path: string | null | undefined): Promise<string | undefined> {
    if (!path) return undefined;

    const cached = this.signedCache.get(path);
    if (cached && Date.now() < cached.expiresAt) return cached.url;
    if (cached) this.signedCache.delete(path);

    // Dedupe concurrent signs for the same path (e.g. repeated passage
    // images across grouped children resolving at once).
    const inFlight = this.inFlightSigns.get(path);
    if (inFlight) return inFlight;

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

    const signPromise = (async (): Promise<string | undefined> => {
      try {
        const res = await fetch(`/api/storage/sign?path=${encodeURIComponent(path)}`);
        if (!res.ok) return undefined;
        const data: unknown = await res.json();
        const signedUrl = isRecord(data) ? asString(data.signedUrl) : undefined;
        if (signedUrl) {
          this.signedCache.set(path, { url: signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
        }
        return signedUrl;
      } catch (error) {
        console.error(`Failed to resolve image URL for path: ${path}`, error);
        return undefined;
      } finally {
        this.inFlightSigns.delete(path);
      }
    })();
    this.inFlightSigns.set(path, signPromise);
    return signPromise;
  }

  private async resolveBarePath(value: unknown): Promise<string | undefined> {
    const path = asString(value);
    if (!path || !isBareStoragePath(path)) return undefined;
    return this.resolveImageUrl(path);
  }

  private async resolveStringArray(value: unknown): Promise<string[] | undefined> {
    if (!Array.isArray(value)) return undefined;
    const resolved = await Promise.all(
      value.map(async (entry: unknown): Promise<string> => {
        const path = asString(entry);
        if (!path) return '';
        const signed = await this.resolveImageUrl(path);
        return signed ?? path;
      }),
    );
    return resolved.filter((entry) => entry.length > 0);
  }

  /**
   * Resolves `content.options` in both shapes:
   * - Array (figure_sequence): produces `options_urls`
   * - Map (module_mcq/module_question): resolves nested `image_url`/`image` in place
   */
  private async resolveOptionsField(content: ImageContent, output: ImageContent): Promise<void> {
    const options = content.options;
    if (Array.isArray(options)) {
      const optionsUrls = await Promise.all(
        options.map(async (option: unknown) => {
          const path =
            typeof option === 'string'
              ? option
              : isRecord(option)
                ? (asString(option.image) ?? asString(option.path) ?? asString(option.image_url))
                : undefined;
          if (!path) return undefined;
          const resolved = await this.resolveImageUrl(path);
          return resolved ?? path;
        }),
      );
      output.options_urls = optionsUrls;
      return;
    }

    if (isRecord(options)) {
      const entries = await Promise.all(
        Object.entries(options).map(async ([key, val]: [string, unknown]): Promise<[string, unknown]> => {
          if (typeof val === 'string') {
            if (!isBareStoragePath(val)) return [key, val];
            const resolved = await this.resolveImageUrl(val);
            return [key, resolved ?? val];
          }
          if (isRecord(val)) {
            const nestedPath = asString(val.image_url) ?? asString(val.image);
            if (!nestedPath || !isBareStoragePath(nestedPath)) return [key, val];
            const resolved = await this.resolveImageUrl(nestedPath);
            if (!resolved) return [key, val];
            return [key, { ...val, image_url: resolved }];
          }
          return [key, val];
        }),
      );
      output.options = Object.fromEntries(entries);
    }
  }

  async resolveImageUrls(content: ImageContent): Promise<ImageContent> {
    const newContent: ImageContent = { ...content };

    // figure_sequence / completing_patterns / latin_square aliases (bare -> *_url)
    const aliasedKeys: Array<{ source: string; target: string }> = [
      { source: 'prompt_image', target: 'prompt_image_url' },
      { source: 'grid_image', target: 'grid_image_url' },
      { source: 'options_image', target: 'options_image_url' },
    ];
    for (const { source, target } of aliasedKeys) {
      const resolved = await this.resolveBarePath(content[source]);
      if (resolved) newContent[target] = resolved;
    }

    // In-place single paths (question + embedded passage)
    const inPlaceKeys = ['question_image', 'image_url', 'passage_image_url'] as const;
    for (const key of inPlaceKeys) {
      const resolved = await this.resolveBarePath(content[key]);
      if (resolved) newContent[key] = resolved;
    }

    // Child-question image rendered by ModuleMCQ (bare -> signed in place)
    const childResolved = await this.resolveBarePath(content.resolved_image_url);
    if (childResolved) newContent.resolved_image_url = childResolved;

    // ModuleQuestion environment gallery
    const environmentImages = await this.resolveStringArray(content.environment_images);
    if (environmentImages) newContent.environment_images = environmentImages;

    await this.resolveOptionsField(content, newContent);

    // Surface embedded passage image as `resolved_image_url` so the
    // renderer (`toModulePassage`) picks it up without extra mapping.
    const embeddedPassageImage =
      asString(newContent.resolved_image_url) ??
      asString(newContent.passage_image_url) ??
      asString(newContent.image_url);
    if (embeddedPassageImage && typeof newContent.resolved_image_url !== 'string') {
      newContent.resolved_image_url = embeddedPassageImage;
    }

    return newContent;
  }

  /**
   * Resolves top-level passage fields (`passages.image_url` -> `resolved_image_url`).
   * Question rows keep their raw `content`; passages carry the image at the top level.
   */
  private async resolveTopLevelImageFields(item: Record<string, unknown>): Promise<Record<string, unknown>> {
    const output: Record<string, unknown> = { ...item };
    const topImage = asString(item.image_url) ?? asString(item.passage_image_url);
    if (!topImage) return output;
    if (!isBareStoragePath(topImage)) {
      if (typeof output.resolved_image_url !== 'string') output.resolved_image_url = topImage;
      return output;
    }
    const resolved = await this.resolveImageUrl(topImage);
    if (resolved) output.resolved_image_url = resolved;
    return output;
  }

  async resolveQuestionImageUrls<T extends QuestionLike>(questions: T[]): Promise<T[]> {
    return Promise.all(
      questions.map(async (question) => {
        const record = question as unknown as Record<string, unknown>;
        const withTopLevel = await this.resolveTopLevelImageFields(record);
        const resolvedChildren = asQuestionArray(question.questions)
          ? await this.resolveQuestionImageUrls(asQuestionArray(question.questions) as T[])
          : undefined;
        const contentRecord = isRecord(question.content) ? question.content : undefined;
        if (Object.keys(withTopLevel).length === Object.keys(record).length && !contentRecord && !resolvedChildren) {
          return question;
        }
        return {
          ...question,
          ...withTopLevel,
          ...(contentRecord ? { content: await this.resolveImageUrls(contentRecord) } : {}),
          ...(resolvedChildren ? { questions: resolvedChildren } : {}),
        } as T;
      }),
    );
  }
}
