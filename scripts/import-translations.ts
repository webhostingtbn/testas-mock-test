/**
 * Translation Import and Stale-Check Script
 *
 * Usage:
 *   npx tsx scripts/import-translations.ts --file <path-to-json> [--apply] [--reviewed]
 *   npx tsx scripts/import-translations.ts --check-stale
 *
 * IMPORTANT BEHAVIOR & ATOMICITY:
 * When applying translations, the script uses:
 *   UPDATE ... SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb)
 * This replaces the ENTIRE German ('de') translation object for each updated row.
 * Consequently, each item in an import file MUST be a complete translation (not a partial diff),
 * containing all translated fields for that item (e.g. question_text, options, etc.). This ensures:
 * 1. Translations remain atomic and consistent without leaving behind orphaned keys from previous versions.
 * 2. The recorded _source_hash accurately matches the full base content at the time of import.
 *
 * NOTE ON SOURCE HASHES & IMAGES:
 * Source hashes intentionally track semantic text content (question_text, options, title, body_markdown,
 * description, environment text). Image URLs are excluded from source hashes because CDN asset relocations
 * or re-encodings should not invalidate text translations; translations requiring German diagram variants
 * override question_image / image_url explicitly.
 */

import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  findTranslationIssues,
  REVIEW_REQUIRED_TYPES,
  isReviewRequiredType,
} from '../src/lib/i18n/localize';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface QuestionTranslationItem {
  id: string;
  question_text?: string;
  question_image?: string;
  options?: Record<string, string>;
  [key: string]: unknown;
}

export interface PassageTranslationItem {
  id: string;
  title?: string;
  body_markdown?: string;
  image_url?: string;
  [key: string]: unknown;
}

export interface SectionTranslationItem {
  id: string;
  title?: string;
  description?: string;
  environment_content?: {
    text?: string;
    images?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface TranslationInputPayload {
  lang: string;
  questions?: QuestionTranslationItem[];
  passages?: PassageTranslationItem[];
  sections?: SectionTranslationItem[];
}

export interface DbQuestionRow {
  id: string;
  question_type: string;
  content: unknown;
  translations: unknown;
}

export interface DbPassageRow {
  id: string;
  title: string | null;
  body_markdown: string | null;
  translations: unknown;
  section_id?: string | null;
  section_question_type?: string | null;
}

export interface DbSectionRow {
  id: string;
  title: string | null;
  description: string | null;
  question_type?: string | null;
  environment_content: unknown;
  translations: unknown;
}

export interface ItemIssue {
  kind: 'question' | 'passage' | 'section';
  id: string;
  issues: string[];
}

function parseCliArgs(): {
  filePath?: string;
  isApply: boolean;
  isReviewed: boolean;
  isCheckStale: boolean;
} {
  const args = process.argv.slice(2);
  let filePath: string | undefined;
  let isApply = false;
  let isReviewed = false;
  let isCheckStale = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file') {
      filePath = args[i + 1];
      i++;
    } else if (arg === '--apply') {
      isApply = true;
    } else if (arg === '--reviewed') {
      isReviewed = true;
    } else if (arg === '--check-stale') {
      isCheckStale = true;
    }
  }

  return { filePath, isApply, isReviewed, isCheckStale };
}

export function computeQuestionSourceHash(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const c = content as Record<string, unknown>;
  const questionText = typeof c.question_text === 'string' ? c.question_text : '';

  const optionsMap: Record<string, string> = {};
  if (Array.isArray(c.options)) {
    for (const opt of c.options) {
      if (isRecord(opt)) {
        const id = typeof opt.id === 'string' ? opt.id : '';
        const text = typeof opt.text === 'string' ? opt.text : '';
        if (id) optionsMap[id] = text;
      }
    }
  } else if (isRecord(c.options)) {
    for (const [key, val] of Object.entries(c.options)) {
      if (typeof val === 'string') {
        optionsMap[key] = val;
      } else if (isRecord(val) && typeof val.text === 'string') {
        optionsMap[key] = val.text;
      }
    }
  }

  const sortedOptionKeys = Object.keys(optionsMap).sort();
  const sortedOptions: Record<string, string> = {};
  for (const k of sortedOptionKeys) {
    sortedOptions[k] = optionsMap[k];
  }

  const canonical = {
    options: sortedOptions,
    question_text: questionText,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function computePassageSourceHash(title: string | null | undefined, bodyMarkdown: string | null | undefined): string {
  const canonical = {
    body_markdown: bodyMarkdown ?? '',
    title: title ?? '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function computeSectionSourceHash(
  title: string | null | undefined,
  description: string | null | undefined,
  environmentContent: unknown,
): string {
  let envText = '';
  if (environmentContent && typeof environmentContent === 'object') {
    const ec = environmentContent as Record<string, unknown>;
    if (typeof ec.text === 'string') {
      envText = ec.text;
    }
  }
  const canonical = {
    description: description ?? '',
    environment_text: envText,
    title: title ?? '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function runCheckStale(client: Client): Promise<void> {
  console.log('Checking for stale translations in database...\n');
  let staleCount = 0;

  // 1. Questions
  const questionsRes = await client.query<DbQuestionRow>(
    `SELECT id, question_type, content, translations FROM questions WHERE translations->'de' IS NOT NULL`
  );
  for (const row of questionsRes.rows) {
    const trans = isRecord(row.translations) ? row.translations : null;
    const de = trans && isRecord(trans.de) ? trans.de : null;
    const storedHash = de && typeof de._source_hash === 'string' ? de._source_hash : null;
    const currentHash = computeQuestionSourceHash(row.content);
    if (storedHash !== currentHash) {
      staleCount++;
      console.log(`[STALE QUESTION] ID: ${row.id} (Stored hash: ${storedHash ?? 'none'}, Current: ${currentHash})`);
    }
  }

  // 2. Passages
  const passagesRes = await client.query<DbPassageRow>(
    `SELECT id, title, body_markdown, translations FROM passages WHERE translations->'de' IS NOT NULL`
  );
  for (const row of passagesRes.rows) {
    const trans = isRecord(row.translations) ? row.translations : null;
    const de = trans && isRecord(trans.de) ? trans.de : null;
    const storedHash = de && typeof de._source_hash === 'string' ? de._source_hash : null;
    const currentHash = computePassageSourceHash(row.title, row.body_markdown);
    if (storedHash !== currentHash) {
      staleCount++;
      console.log(`[STALE PASSAGE] ID: ${row.id} (Stored hash: ${storedHash ?? 'none'}, Current: ${currentHash})`);
    }
  }

  // 3. Sections
  const sectionsRes = await client.query<DbSectionRow>(
    `SELECT id, title, description, environment_content, translations FROM sections WHERE translations->'de' IS NOT NULL`
  );
  for (const row of sectionsRes.rows) {
    const trans = isRecord(row.translations) ? row.translations : null;
    const de = trans && isRecord(trans.de) ? trans.de : null;
    const storedHash = de && typeof de._source_hash === 'string' ? de._source_hash : null;
    const currentHash = computeSectionSourceHash(row.title, row.description, row.environment_content);
    if (storedHash !== currentHash) {
      staleCount++;
      console.log(`[STALE SECTION] ID: ${row.id} (Stored hash: ${storedHash ?? 'none'}, Current: ${currentHash})`);
    }
  }

  console.log(`\nStale check complete. ${staleCount} stale item(s) found.`);
}

export interface ProcessTranslationsParams {
  payload: TranslationInputPayload;
  isReviewed: boolean;
  baseQuestions: Map<string, DbQuestionRow>;
  basePassages: Map<string, DbPassageRow>;
  baseSections: Map<string, DbSectionRow>;
}

export interface ProcessTranslationsResult {
  issues: ItemIssue[];
  questionUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }>;
  passageUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }>;
  sectionUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }>;
}

export function processTranslationPayload(params: ProcessTranslationsParams): ProcessTranslationsResult {
  const { payload, isReviewed, baseQuestions, basePassages, baseSections } = params;
  const issues: ItemIssue[] = [];
  const questionUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }> = [];
  const passageUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }> = [];
  const sectionUpdates: Array<{ id: string; translationWithHash: Record<string, unknown> }> = [];

  // 1. Process Questions
  if (Array.isArray(payload.questions)) {
    for (const qItem of payload.questions) {
      if (!isValidUuid(qItem.id)) {
        issues.push({ kind: 'question', id: String(qItem.id), issues: ['Invalid UUID format'] });
        continue;
      }

      const baseRow = baseQuestions.get(qItem.id);
      if (!baseRow) {
        issues.push({ kind: 'question', id: qItem.id, issues: ['Question not found in database'] });
        continue;
      }

      if (isReviewRequiredType(baseRow.question_type) && !isReviewed) {
        issues.push({
          kind: 'question',
          id: qItem.id,
          issues: [
            `Question type "${baseRow.question_type}" requires review. Pass --reviewed to apply this translation.`,
          ],
        });
      }

      const { id: _id, ...translationData } = qItem;
      const validationIssues = findTranslationIssues('question', { content: baseRow.content }, translationData);
      if (validationIssues.length > 0) {
        issues.push({ kind: 'question', id: qItem.id, issues: validationIssues });
      } else {
        const sourceHash = computeQuestionSourceHash(baseRow.content);
        questionUpdates.push({
          id: qItem.id,
          translationWithHash: {
            ...translationData,
            _source_hash: sourceHash,
          },
        });
      }
    }
  }

  // 2. Process Passages
  if (Array.isArray(payload.passages)) {
    for (const pItem of payload.passages) {
      if (!isValidUuid(pItem.id)) {
        issues.push({ kind: 'passage', id: String(pItem.id), issues: ['Invalid UUID format'] });
        continue;
      }

      const baseRow = basePassages.get(pItem.id);
      if (!baseRow) {
        issues.push({ kind: 'passage', id: pItem.id, issues: ['Passage not found in database'] });
        continue;
      }

      const sectionType =
        baseRow.section_question_type ??
        (baseRow.section_id ? baseSections.get(baseRow.section_id)?.question_type : null);

      if (sectionType && isReviewRequiredType(sectionType) && !isReviewed) {
        issues.push({
          kind: 'passage',
          id: pItem.id,
          issues: [
            `Passage belongs to section type "${sectionType}" which requires review. Pass --reviewed to apply this translation.`,
          ],
        });
      }

      const { id: _id, ...translationData } = pItem;
      const validationIssues = findTranslationIssues(
        'passage',
        { title: baseRow.title, body_markdown: baseRow.body_markdown },
        translationData
      );
      if (validationIssues.length > 0) {
        issues.push({ kind: 'passage', id: pItem.id, issues: validationIssues });
      } else {
        const sourceHash = computePassageSourceHash(baseRow.title, baseRow.body_markdown);
        passageUpdates.push({
          id: pItem.id,
          translationWithHash: {
            ...translationData,
            _source_hash: sourceHash,
          },
        });
      }
    }
  }

  // 3. Process Sections
  if (Array.isArray(payload.sections)) {
    for (const sItem of payload.sections) {
      if (!isValidUuid(sItem.id)) {
        issues.push({ kind: 'section', id: String(sItem.id), issues: ['Invalid UUID format'] });
        continue;
      }

      const baseRow = baseSections.get(sItem.id);
      if (!baseRow) {
        issues.push({ kind: 'section', id: sItem.id, issues: ['Section not found in database'] });
        continue;
      }

      const { id: _id, ...translationData } = sItem;
      const validationIssues = findTranslationIssues(
        'section',
        {
          title: baseRow.title,
          description: baseRow.description,
          environment_content: baseRow.environment_content,
        },
        translationData
      );
      if (validationIssues.length > 0) {
        issues.push({ kind: 'section', id: sItem.id, issues: validationIssues });
      } else {
        const sourceHash = computeSectionSourceHash(baseRow.title, baseRow.description, baseRow.environment_content);
        sectionUpdates.push({
          id: sItem.id,
          translationWithHash: {
            ...translationData,
            _source_hash: sourceHash,
          },
        });
      }
    }
  }

  return { issues, questionUpdates, passageUpdates, sectionUpdates };
}

/**
 * Connects to PostgreSQL, with connection pooling rewrite if applicable.
 */
export function getDbClient(): Client {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  if (connectionString.includes('db.izcudijmubegczhfcjlw.supabase.co')) {
    connectionString = connectionString
      .replace('db.izcudijmubegczhfcjlw.supabase.co', 'aws-1-ap-northeast-2.pooler.supabase.com')
      .replace('postgresql://postgres:', 'postgresql://postgres.izcudijmubegczhfcjlw:');
  }

  return new Client({ connectionString });
}

async function main(): Promise<void> {
  const { filePath, isApply, isReviewed, isCheckStale } = parseCliArgs();

  let payload: TranslationInputPayload | null = null;
  if (!isCheckStale) {
    if (!filePath) {
      console.error('ERROR: Missing --file <path> argument. Example: --file translations/de.json');
      process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`ERROR: File not found: ${resolvedPath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileContent);
    } catch (err) {
      console.error('ERROR: Failed to parse JSON file:', err);
      process.exit(1);
    }

    if (!isRecord(parsedJson) || typeof parsedJson.lang !== 'string') {
      console.error('ERROR: Invalid JSON format: root must be an object with a "lang" string field.');
      process.exit(1);
    }

    if (parsedJson.lang !== 'de') {
      console.error(`ERROR: Unsupported language "${parsedJson.lang}". Only "de" is supported.`);
      process.exit(1);
    }

    payload = {
      lang: parsedJson.lang,
      questions: Array.isArray(parsedJson.questions) ? (parsedJson.questions as QuestionTranslationItem[]) : undefined,
      passages: Array.isArray(parsedJson.passages) ? (parsedJson.passages as PassageTranslationItem[]) : undefined,
      sections: Array.isArray(parsedJson.sections) ? (parsedJson.sections as SectionTranslationItem[]) : undefined,
    };
  }

  let client: Client;
  try {
    client = getDbClient();
    await client.connect();
  } catch (err) {
    console.error('ERROR: Failed to connect to database:', err);
    process.exit(1);
  }

  try {
    if (isCheckStale) {
      await runCheckStale(client);
      return;
    }

    if (!payload) {
      console.error('ERROR: No payload loaded');
      process.exit(1);
    }

    const baseQuestions = new Map<string, DbQuestionRow>();
    if (Array.isArray(payload.questions) && payload.questions.length > 0) {
      const validQIds = payload.questions.map((q) => q.id).filter(isValidUuid);
      if (validQIds.length > 0) {
        const res = await client.query<DbQuestionRow>(
          'SELECT id, question_type, content, translations FROM questions WHERE id = ANY($1::uuid[])',
          [validQIds]
        );
        for (const row of res.rows) {
          baseQuestions.set(row.id, row);
        }
      }
    }

    const basePassages = new Map<string, DbPassageRow>();
    if (Array.isArray(payload.passages) && payload.passages.length > 0) {
      const validPIds = payload.passages.map((p) => p.id).filter(isValidUuid);
      if (validPIds.length > 0) {
        const res = await client.query<DbPassageRow>(
          `SELECT p.id, p.title, p.body_markdown, p.translations, p.section_id, s.question_type AS section_question_type
           FROM passages p
           LEFT JOIN sections s ON p.section_id = s.id
           WHERE p.id = ANY($1::uuid[])`,
          [validPIds]
        );
        for (const row of res.rows) {
          basePassages.set(row.id, row);
        }
      }
    }

    const baseSections = new Map<string, DbSectionRow>();
    if (Array.isArray(payload.sections) && payload.sections.length > 0) {
      const validSIds = payload.sections.map((s) => s.id).filter(isValidUuid);
      if (validSIds.length > 0) {
        const res = await client.query<DbSectionRow>(
          'SELECT id, title, description, question_type, environment_content, translations FROM sections WHERE id = ANY($1::uuid[])',
          [validSIds]
        );
        for (const row of res.rows) {
          baseSections.set(row.id, row);
        }
      }
    }

    const { issues, questionUpdates, passageUpdates, sectionUpdates } = processTranslationPayload({
      payload,
      isReviewed,
      baseQuestions,
      basePassages,
      baseSections,
    });

    // Report
    console.log(`\n=== Translation Import Report ===`);
    console.log(`Mode: ${isApply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Language: ${payload.lang}`);
    console.log(`Questions to update: ${questionUpdates.length}`);
    console.log(`Passages to update:  ${passageUpdates.length}`);
    console.log(`Sections to update:  ${sectionUpdates.length}`);
    console.log(`Total issues found:  ${issues.length}\n`);

    if (issues.length > 0) {
      console.error('Validation issues encountered:');
      for (const issue of issues) {
        console.error(`- [${issue.kind.toUpperCase()}] ${issue.id}:`);
        for (const msg of issue.issues) {
          console.error(`    • ${msg}`);
        }
      }
      console.error(`\nAborted. No changes written.`);
      process.exit(1);
    }

    if (!isApply) {
      console.log('Dry run successful! All items passed validation. Pass --apply to write to the database.');
      return;
    }

    // Apply transaction
    console.log('Applying translations to database in a single transaction...');
    await client.query('BEGIN');
    try {
      for (const q of questionUpdates) {
        await client.query(
          `UPDATE questions SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
          [JSON.stringify(q.translationWithHash), q.id]
        );
      }

      for (const p of passageUpdates) {
        await client.query(
          `UPDATE passages SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
          [JSON.stringify(p.translationWithHash), p.id]
        );
      }

      for (const s of sectionUpdates) {
        await client.query(
          `UPDATE sections SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
          [JSON.stringify(s.translationWithHash), s.id]
        );
      }

      await client.query('COMMIT');
      console.log('Successfully committed all translations to database!');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to commit transaction. Rolled back:', err);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  void main();
}
