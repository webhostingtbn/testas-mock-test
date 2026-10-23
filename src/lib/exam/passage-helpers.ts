/**
 * Pure helper functions and interfaces for passage conversion and routing.
 * Kept free of React/CSS dependencies so they can be imported and tested cleanly in Node.
 */

export interface ModuleQuestionData {
  id: string;
  sort_order: number;
  content: {
    question_text: string;
    options: Record<string, string>;
    context_text?: string;
    resolved_image_url?: string;
    resolved_image_urls?: string[];
  };
}

export interface ModulePassageData {
  id: string;
  title: string;
  body_markdown: string;
  image_url?: string;
  resolved_image_url?: string;
  questions: ModuleQuestionData[];
}

export interface QuestionData {
  id: string;
  sectionId: string;
  sortOrder: number;
  questionType: string;
  content: unknown;
  isPassage?: boolean;
  questions?: QuestionData[];
  title?: string;
  body_markdown?: string;
  image_url?: string;
  resolved_image_url?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuidString(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Converts a raw or grouped QuestionData item (mock passage, digital passage, or practice item)
 * into the ModulePassageData format required by ModuleMCQ.
 *
 * Ensures passage images (both image_url and resolved_image_url) are accurately
 * preserved and prioritized from the top level, falling back to embedded content fields.
 */
export function convertToModulePassage(passage: QuestionData): ModulePassageData {
  const content = isRecord(passage.content) ? passage.content : {};
  const pRecord = passage as unknown as Record<string, unknown>;

  let rawTitle =
    (typeof pRecord.title === 'string' ? pRecord.title : undefined) ??
    (typeof content.title === 'string' ? content.title : undefined) ??
    (typeof content.passage_title === 'string' ? content.passage_title : undefined);
  if (!rawTitle && passage.sectionId && !isUuidString(passage.sectionId)) {
    rawTitle = passage.sectionId;
  }
  const title = rawTitle || 'Reference Information';

  const bodyMarkdown =
    (typeof pRecord.body_markdown === 'string' ? pRecord.body_markdown : undefined) ??
    (typeof content.body_markdown === 'string' ? content.body_markdown : undefined) ??
    (typeof content.passage_markdown === 'string' ? content.passage_markdown : undefined) ??
    (typeof content.passage_text === 'string' ? content.passage_text : '');

  // Passage graphic belongs strictly to the reference passage (left pane).
  // In mock tests, passages have top-level image_url / resolved_image_url (isPassage: true).
  // In practice mode, individual questions carry passage_image_url in their content.
  const imageUrl =
    (typeof pRecord.image_url === 'string' ? pRecord.image_url : undefined) ??
    (typeof content.image_url === 'string' ? content.image_url : undefined) ??
    (typeof content.passage_image_url === 'string' ? content.passage_image_url : undefined);

  const resolvedImageUrl =
    (typeof pRecord.resolved_image_url === 'string' ? pRecord.resolved_image_url : undefined) ??
    (typeof content.resolved_image_url === 'string' ? content.resolved_image_url : undefined) ??
    (typeof content.passage_image_url === 'string' ? content.passage_image_url : undefined) ??
    imageUrl;

  let questions: ModuleQuestionData[];

  if (passage.questions && passage.questions.length > 0) {
    questions = passage.questions.map((q) => {
      const qContent = isRecord(q.content) ? q.content : {};
      const qRecord = q as unknown as Record<string, unknown>;
      const childResolved =
        typeof qContent.question_image === 'string'
          ? qContent.question_image
          : typeof qContent.resolved_image_url === 'string' &&
            qContent.resolved_image_url !== resolvedImageUrl &&
            qContent.resolved_image_url !== imageUrl
          ? qContent.resolved_image_url
          : undefined;
      const childResolvedUrls = Array.isArray(qContent.resolved_image_urls)
        ? qContent.resolved_image_urls.filter(
            (u): u is string =>
              typeof u === 'string' &&
              u !== imageUrl &&
              u !== resolvedImageUrl,
          )
        : undefined;
      const childContextText = typeof qContent.context_text === 'string' ? qContent.context_text : undefined;
      return {
        id: q.id,
        sort_order: typeof qRecord.sort_order === 'number' ? qRecord.sort_order : (q.sortOrder ?? 1),
        content: {
          question_text: typeof qContent.question_text === 'string' ? qContent.question_text : '',
          options: (isRecord(qContent.options) || Array.isArray(qContent.options) ? qContent.options : {}) as unknown as Record<string, string>,
          ...(childContextText ? { context_text: childContextText } : {}),
          ...(childResolved ? { resolved_image_url: childResolved } : {}),
          ...(childResolvedUrls && childResolvedUrls.length > 0 ? { resolved_image_urls: childResolvedUrls } : {}),
        },
      };
    });
  } else {
    // Single question passed directly (e.g. Practice Mode)
    const singleResolved =
      typeof content.question_image === 'string'
        ? content.question_image
        : typeof content.resolved_image_url === 'string' &&
          content.resolved_image_url !== resolvedImageUrl &&
          content.resolved_image_url !== imageUrl
        ? content.resolved_image_url
        : undefined;
    const singleResolvedUrls = Array.isArray(content.resolved_image_urls)
      ? content.resolved_image_urls.filter(
          (u): u is string =>
            typeof u === 'string' &&
            u !== imageUrl &&
            u !== resolvedImageUrl,
        )
      : undefined;
    const singleContextText = typeof content.context_text === 'string' ? content.context_text : undefined;
    questions = [
      {
        id: passage.id,
        sort_order: typeof pRecord.sort_order === 'number' ? pRecord.sort_order : (passage.sortOrder ?? 1),
        content: {
          question_text: typeof content.question_text === 'string' ? content.question_text : (typeof passage.content === 'string' ? passage.content : ''),
          options: (isRecord(content.options) || Array.isArray(content.options) ? content.options : {}) as unknown as Record<string, string>,
          ...(singleContextText ? { context_text: singleContextText } : {}),
          ...(singleResolved ? { resolved_image_url: singleResolved } : {}),
          ...(singleResolvedUrls && singleResolvedUrls.length > 0 ? { resolved_image_urls: singleResolvedUrls } : {}),
        },
      },
    ];
  }

  return {
    id: passage.id,
    title,
    body_markdown: bodyMarkdown,
    image_url: imageUrl,
    resolved_image_url: resolvedImageUrl,
    questions,
  };
}
