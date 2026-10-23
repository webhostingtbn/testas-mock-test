import type { Lang } from './config';

export interface QuestionTranslation {
  context_text?: string;
  question_text?: string;
  question_image?: string;
  question_image_2?: string;
  question_image_3?: string;
  question_image_a?: string;
  question_image_b?: string;
  question_image_o?: string;
  options?: Record<string, string>;
  _source_hash?: string;
}

export interface PassageTranslation {
  title?: string;
  body_markdown?: string;
  image_url?: string;
  _source_hash?: string;
}

export interface SectionTranslation {
  title?: string;
  description?: string;
  environment_content?: {
    text?: string;
    images?: string[];
  };
  _source_hash?: string;
}

export type ContentTranslations = Record<string, unknown> | null;

export const REVIEW_REQUIRED_TYPES = ['linguistic_structures', 'interpreting_texts'] as const;
export type ReviewRequiredType = (typeof REVIEW_REQUIRED_TYPES)[number];

export function isReviewRequiredType(questionType: string): questionType is ReviewRequiredType {
  return (REVIEW_REQUIRED_TYPES as readonly string[]).includes(questionType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripTranslations<T>(row: T): Omit<T, 'translations'> {
  if (!isRecord(row)) return row as Omit<T, 'translations'>;
  const rest = { ...row };
  delete rest.translations;
  return rest as Omit<T, 'translations'>;
}

function applyStringOverrides(
  target: Record<string, unknown>,
  source: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): void {
  if (!source) return;
  for (const f of fields) {
    const val = source[f];
    if (typeof val === 'string' && val.trim() !== '') {
      target[f] = val;
    }
  }
}

function getDeTranslation<T>(row: T): Record<string, unknown> | null {
  if (!isRecord(row) || !isRecord(row.translations) || !isRecord(row.translations.de)) {
    return null;
  }
  return row.translations.de as Record<string, unknown>;
}

function localizeQuestionRow<T>(row: T, lang: Lang): Omit<T, 'translations'> {
  const stripped = stripTranslations(row);
  if (lang === 'en' || !isRecord(stripped)) return stripped;

  const copy = { ...stripped };
  const copyRec = copy as Record<string, unknown>;
  const content = copyRec.content;
  if (!isRecord(content)) return stripped;

  const de = getDeTranslation(row);
  if (!de) return stripped;

  const newContent = { ...content };
  applyStringOverrides(newContent, de, [
    'context_text',
    'question_text',
    'question_image',
    'question_image_2',
    'question_image_3',
    'question_image_a',
    'question_image_b',
    'question_image_o',
  ]);

  // If base question had context_text, but the translation did not supply context_text explicitly:
  // Check if de.question_text bundled the context before \n\n.
  if (
    typeof content.context_text === 'string' &&
    content.context_text.trim() !== '' &&
    typeof de.context_text !== 'string' &&
    typeof de.question_text === 'string'
  ) {
    if (de.question_text.includes('\n\n')) {
      const splitIdx = de.question_text.indexOf('\n\n');
      newContent.context_text = de.question_text.slice(0, splitIdx).trim();
      newContent.question_text = de.question_text.slice(splitIdx + 2).trim();
    } else {
      // Translation did not include context_text, clear untranslated base context_text
      delete newContent.context_text;
    }
  }

  if (isRecord(de.options)) {
    const trOpts = de.options;
    const baseOpts = newContent.options;
    if (Array.isArray(baseOpts)) {
      newContent.options = baseOpts.map((opt) => {
        if (!isRecord(opt) || typeof opt.id !== 'string') return opt;
        const text = trOpts[opt.id];
        return typeof text === 'string' && text.trim() !== '' ? { ...opt, text } : { ...opt };
      });
    } else if (isRecord(baseOpts)) {
      const updated: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(baseOpts)) {
        const text = trOpts[key];
        updated[key] = typeof text === 'string' && text.trim() !== '' ? text : val;
      }
      newContent.options = updated;
    }
  }

  copyRec.content = newContent;
  return copy;
}

function localizePassageRow<T>(row: T, lang: Lang): Omit<T, 'translations'> {
  const stripped = stripTranslations(row);
  if (lang === 'en' || !isRecord(stripped)) return stripped;

  const de = getDeTranslation(row);
  if (!de) return stripped;

  const copy = { ...stripped };
  applyStringOverrides(copy as Record<string, unknown>, de, ['title', 'body_markdown', 'image_url']);
  return copy;
}

function localizeSectionRow<T>(row: T, lang: Lang): Omit<T, 'translations'> {
  const stripped = stripTranslations(row);
  if (lang === 'en' || !isRecord(stripped)) return stripped;

  const de = getDeTranslation(row);
  if (!de) return stripped;

  const copy = { ...stripped };
  const copyRec = copy as Record<string, unknown>;
  applyStringOverrides(copyRec, de, ['title', 'description']);

  if (isRecord(de.environment_content)) {
    const baseEnv = isRecord(copyRec.environment_content) ? { ...copyRec.environment_content } : {};
    const deEnv = de.environment_content;
    if (typeof deEnv.text === 'string' && deEnv.text.trim() !== '') {
      baseEnv.text = deEnv.text;
    }
    if (Array.isArray(deEnv.images) && deEnv.images.length > 0) {
      baseEnv.images = deEnv.images;
    }
    copyRec.environment_content = baseEnv;
  }

  return copy;
}

export function localizeExamData<
  S = unknown,
  P = unknown,
  Q = unknown,
>(
  bundle: { sections?: S[]; passages?: P[]; questions?: Q[] },
  lang: Lang,
): {
  sections: Array<Omit<S, 'translations'>>;
  passages: Array<Omit<P, 'translations'>>;
  questions: Array<Omit<Q, 'translations'>>;
} {
  return {
    sections: (bundle.sections ?? []).map((sec) => localizeSectionRow(sec, lang)),
    passages: (bundle.passages ?? []).map((p) => localizePassageRow(p, lang)),
    questions: (bundle.questions ?? []).map((q) => localizeQuestionRow(q, lang)),
  };
}

const ALLOWED_KEYS = {
  question: new Set([
    'context_text',
    'question_text',
    'question_image',
    'question_image_2',
    'question_image_3',
    'question_image_a',
    'question_image_b',
    'question_image_o',
    'options',
  ]),
  passage: new Set(['title', 'body_markdown', 'image_url']),
  section: new Set(['title', 'description', 'environment_content']),
} as const;

function checkString(
  tr: Record<string, unknown>,
  field: string,
  baseText: unknown,
  issues: string[],
): void {
  const val = tr[field];
  const hasBaseText = typeof baseText === 'string' && baseText.trim() !== '';
  if (val === undefined) {
    if (hasBaseText) {
      issues.push(`${field} is required when base has text`);
    }
    return;
  }
  if (typeof val !== 'string') {
    issues.push(`${field} must be a string`);
  } else if (val.trim() === '' && hasBaseText) {
    issues.push(`${field} cannot be empty when base has text`);
  }
}

export function findTranslationIssues(
  kind: 'question' | 'passage' | 'section',
  baseRow: unknown,
  translation: unknown,
): string[] {
  if (!isRecord(translation)) return ['Translation must be an object'];

  const issues: string[] = [];
  const allowed = ALLOWED_KEYS[kind];

  for (const k of Object.keys(translation)) {
    if (!k.startsWith('_') && !allowed.has(k)) {
      issues.push(`Unknown key: "${k}"`);
    }
  }

  if (kind === 'question') {
    const baseContent = isRecord(baseRow) && isRecord(baseRow.content) ? baseRow.content : null;
    checkString(translation, 'question_text', baseContent?.question_text, issues);

    if (translation.context_text !== undefined && typeof translation.context_text !== 'string') {
      issues.push('context_text must be a string');
    }

    const optionalImageKeys = [
      'question_image',
      'question_image_2',
      'question_image_3',
      'question_image_a',
      'question_image_b',
      'question_image_o',
    ] as const;
    for (const key of optionalImageKeys) {
      if (translation[key] !== undefined && typeof translation[key] !== 'string') {
        issues.push(`${key} must be a string`);
      }
    }

    const allBaseOptionIds = new Set<string>();
    const requiredOptionIds = new Set<string>();
    if (baseContent && baseContent.options !== undefined) {
      if (Array.isArray(baseContent.options)) {
        for (const opt of baseContent.options) {
          if (isRecord(opt) && typeof opt.id === 'string' && opt.id) {
            allBaseOptionIds.add(opt.id);
            const text = typeof opt.text === 'string' ? opt.text.trim() : '';
            if (text !== '') requiredOptionIds.add(opt.id);
          }
        }
      } else if (isRecord(baseContent.options)) {
        for (const [key, val] of Object.entries(baseContent.options)) {
          allBaseOptionIds.add(key);
          let text = '';
          if (typeof val === 'string') {
            text = val.trim();
          } else if (isRecord(val) && typeof val.text === 'string') {
            text = val.text.trim();
          }
          if (text !== '') requiredOptionIds.add(key);
        }
      }
    }

    if (translation.options !== undefined) {
      if (!isRecord(translation.options)) {
        issues.push('options must be an object');
      } else {
        const trOpts = translation.options;
        for (const [optId, optVal] of Object.entries(trOpts)) {
          if (typeof optVal !== 'string') issues.push(`Option "${optId}" must be a string`);
          if (!allBaseOptionIds.has(optId)) issues.push(`Unknown option id: "${optId}"`);
        }

        for (const optId of requiredOptionIds) {
          const val = trOpts[optId];
          if (val === undefined) {
            issues.push(`Option "${optId}" is required when base has text`);
          } else if (typeof val === 'string' && val.trim() === '') {
            issues.push(`Option "${optId}" cannot be empty when base has text`);
          }
        }
      }
    } else if (requiredOptionIds.size > 0) {
      for (const optId of requiredOptionIds) {
        issues.push(`Option "${optId}" is required when base has text`);
      }
    }
  } else if (kind === 'passage') {
    const baseTitle = isRecord(baseRow) && typeof baseRow.title === 'string' ? baseRow.title : null;
    checkString(translation, 'title', baseTitle, issues);

    const baseBody = isRecord(baseRow) && typeof baseRow.body_markdown === 'string' ? baseRow.body_markdown : null;
    checkString(translation, 'body_markdown', baseBody, issues);

    if (translation.image_url !== undefined && typeof translation.image_url !== 'string') {
      issues.push('image_url must be a string');
    }
  } else {
    const baseTitle = isRecord(baseRow) && typeof baseRow.title === 'string' ? baseRow.title : null;
    checkString(translation, 'title', baseTitle, issues);

    const baseDesc = isRecord(baseRow) && typeof baseRow.description === 'string' ? baseRow.description : null;
    checkString(translation, 'description', baseDesc, issues);

    const baseEnvText =
      isRecord(baseRow) &&
      isRecord(baseRow.environment_content) &&
      typeof baseRow.environment_content.text === 'string'
        ? baseRow.environment_content.text
        : null;
    const hasBaseEnvText = typeof baseEnvText === 'string' && baseEnvText.trim() !== '';

    if (translation.environment_content !== undefined) {
      if (!isRecord(translation.environment_content)) {
        issues.push('environment_content must be an object');
      } else {
        const env = translation.environment_content;
        for (const k of Object.keys(env)) {
          if (k !== 'text' && k !== 'images') issues.push(`Unknown key in environment_content: "${k}"`);
        }
        if (env.text !== undefined && typeof env.text !== 'string') {
          issues.push('environment_content.text must be a string');
        } else if (
          hasBaseEnvText &&
          (env.text === undefined || (typeof env.text === 'string' && env.text.trim() === ''))
        ) {
          issues.push('environment_content.text cannot be empty when base has text');
        }
        if (env.images !== undefined && (!Array.isArray(env.images) || env.images.some((i) => typeof i !== 'string'))) {
          issues.push('environment_content.images must be an array of strings');
        }
      }
    } else if (hasBaseEnvText) {
      issues.push('environment_content is required when base has text');
    }
  }

  return issues;
}
