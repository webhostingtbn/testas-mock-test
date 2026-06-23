'use client';

import { createClient } from '@/lib/supabase/client';

// Storage bucket name - can be overridden via environment variable
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'ExamDataset';

/**
 * ImageService - Abstracts storage bucket image resolution
 *
 * This adapter hides implementation details (bucket name, storage path resolution)
 * from consumers like the exam page. If storage changes (S3 to Cloudinary, etc.),
 * only this service needs to be updated.
 */
export class ImageService {
  private supabase = createClient();

  /**
   * Resolves a single image path to a full public URL
   * @param path - The storage path (e.g., 'images/question1.png')
   * @returns The full public URL, or the original path if it's already a URL
   */
  async resolveImageUrl(path: string | null | undefined): Promise<string | undefined> {
    if (!path) return undefined;

    // Already a full URL, return as-is
    if (path.startsWith('http') || path.startsWith('/')) {
      return path;
    }

    try {
      const { data } = this.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error(`Failed to resolve image URL for path: ${path}`, error);
      return undefined;
    }
  }

  /**
   * Resolves all image paths in an object to full public URLs
   * Mutates the object and returns it with resolved URLs
   *
   * @param content - The content object containing image paths
   * @returns The content object with resolved image URLs
   */
  async resolveImageUrls(content: Record<string, any>): Promise<Record<string, any>> {
    if (!content) return content;

    const newContent = { ...content };

    // 1. Resolve prompt_image (FigureSequence)
    if (content.prompt_image) {
      const resolved = await this.resolveImageUrl(content.prompt_image);
      if (resolved) {
        newContent.prompt_image_url = resolved;
      }
    }

    // 2. Resolve options as image paths (FigureSequence options_urls)
    if (content.options && Array.isArray(content.options)) {
      const optionsUrls = await Promise.all(
        content.options.map(async (opt: any) => {
          // Handle both string paths and objects with image property
          const path = typeof opt === 'string' ? opt : (opt?.image || opt?.path);
          if (!path) return undefined;
          const resolved = await this.resolveImageUrl(path);
          return resolved || path;
        })
      );
      newContent.options_urls = optionsUrls;
    }

    // 3. Resolve grid_image (LatinSquare & CompletingPatterns)
    if (content.grid_image) {
      const resolved = await this.resolveImageUrl(content.grid_image);
      if (resolved) {
        newContent.grid_image_url = resolved;
      }
    }

    // 4. Resolve options_image (CompletingPatterns)
    if (content.options_image) {
      const resolved = await this.resolveImageUrl(content.options_image);
      if (resolved) {
        newContent.options_image_url = resolved;
      }
    }

    // 5. Resolve question_image (ModuleQuestion)
    if (content.question_image) {
      const resolved = await this.resolveImageUrl(content.question_image);
      if (resolved) {
        newContent.question_image = resolved;
      }
    }

    // 6. Resolve image_url (ModuleQuestion / standard)
    if (content.image_url) {
      const resolved = await this.resolveImageUrl(content.image_url);
      if (resolved) {
        newContent.image_url = resolved;
      }
    }

    // 7. Resolve option images inside standard MCQ options (ModuleQuestion options)
    if (content.options && typeof content.options === 'object') {
      if (Array.isArray(content.options)) {
        newContent.options = await Promise.all(
          content.options.map(async (opt: any) => {
            if (opt && typeof opt === 'object' && opt.image) {
              const resolved = await this.resolveImageUrl(opt.image);
              if (resolved) {
                return { ...opt, image: resolved };
              }
            }
            return opt;
          })
        );
      } else {
        // Key-value options
        const updatedOptions: Record<string, any> = {};
        for (const [key, val] of Object.entries(content.options)) {
          if (val && typeof val === 'object' && (val as any).image) {
            const optImage = (val as any).image;
            const resolved = await this.resolveImageUrl(optImage);
            if (resolved) {
              updatedOptions[key] = { ...(val as any), image: resolved };
            } else {
              updatedOptions[key] = val;
            }
          } else {
            updatedOptions[key] = val;
          }
        }
        newContent.options = updatedOptions;
      }
    }

    return newContent;
  }

  /**
   * Resolves image URLs for an array of question objects
   * @param questions - Array of question objects with content containing image paths
   * @returns Array of question objects with resolved image URLs
   */
  async resolveQuestionImageUrls(questions: any[]): Promise<any[]> {
    return Promise.all(
      questions.map(async (q: any) => {
        if (!q?.content) return q;
        return {
          ...q,
          content: await this.resolveImageUrls(q.content),
        };
      })
    );
  }
}
