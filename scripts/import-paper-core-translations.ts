/**
 * Automated Importer for German PaperCore Content
 *
 * Extracts German questions, options, and section translations from:
 *   /Users/rzy/Desktop/ProjectWithTien/Web/testas/PAPER/PaperCore/GER
 * Pairs with English base text, maps to existing database records, validates,
 * and updates public.questions.translations and public.sections.translations.
 *
 * Usage:
 *   npx tsx scripts/import-paper-core-translations.ts [--dry-run] [--apply] [--out <path>]
 */

import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  processTranslationPayload,
  computeQuestionSourceHash,
  computeSectionSourceHash,
  getDbClient,
  type TranslationInputPayload,
  type QuestionTranslationItem,
  type SectionTranslationItem,
  type DbQuestionRow,
  type DbPassageRow,
  type DbSectionRow,
} from './import-translations';

export interface RawParsedQuestion {
  sortOrder: number;
  questionText: string;
  questionImage?: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string | null;
  rawContent: Record<string, unknown>;
}

export interface SectionDescriptor {
  type: string;
  deTitle: string;
  deDescription?: string;
}

const SECTION_TRANSLATIONS: Record<string, SectionDescriptor> = {
  solving_quantitative: {
    type: 'solving_quantitative',
    deTitle: 'Quantitative Probleme lösen',
    deDescription: 'Kerntest — mathematische Textaufgaben lösen (~2 Min. pro Aufgabe)',
  },
  inferring_relationships: {
    type: 'inferring_relationships',
    deTitle: 'Beziehungen erschließen',
    deDescription: 'Kerntest — logische Beziehungen zwischen Begriffspaaren erkennen (27 Sek. pro Aufgabe)',
  },
  numerical_series: {
    type: 'numerical_series',
    deTitle: 'Zahlenreihen fortsetzen',
    deDescription: 'Kerntest — eine Zahlen- oder Symbolreihe durch Erkennen des Musters fortsetzen (68 Sek. pro Aufgabe)',
  },
  completing_patterns: {
    type: 'completing_patterns',
    deTitle: 'Muster ergänzen',
    deDescription: 'Kerntest — das fehlende Element in einer visuellen Musterfolge finden (55 Sek. pro Aufgabe)',
  },
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes SQL content by replacing non-breaking spaces and fixing stray syntax tokens.
 */
export function sanitizeSql(raw: string): string {
  return raw
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/\r\n/g, '\n');
}

/**
 * Parses SQL tuples from a PaperCore VALUES statement.
 * Matches (sort_order, $$ { ... } $$, '...') format.
 */
export function parsePaperCoreSql(filePath: string): RawParsedQuestion[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const rawSql = fs.readFileSync(filePath, 'utf8');
  const sql = sanitizeSql(rawSql);
  // Only split on $$ and $q$ (avoid LaTeX math like $v_1$ or $P_2$)
  const chunks = sql.split(/\$\$|\$q\$/);
  const questions: RawParsedQuestion[] = [];

  for (let i = 1; i < chunks.length; i += 2) {
    let jsonStr = chunks[i].trim();
    const prevChunk = chunks[i - 1];
    const postChunk = chunks[i + 1] || '';

    // Handle stray double closing braces e.g. "}\n}"
    if (jsonStr.endsWith('}') && jsonStr.lastIndexOf('}') > 0) {
      const lastIndex = jsonStr.lastIndexOf('}');
      const secondToLast = jsonStr.lastIndexOf('}', lastIndex - 1);
      if (secondToLast !== -1 && jsonStr.slice(secondToLast + 1).trim() === '}') {
        jsonStr = jsonStr.slice(0, secondToLast + 1).trim();
      }
    }

    const orderMatch = prevChunk.match(/\(\s*(\d+)\s*,\s*(?:'[^']+'\s*,\s*)?$/);
    const sortOrder = orderMatch ? parseInt(orderMatch[1], 10) : Math.floor((i + 1) / 2);

    const ansMatch = postChunk.match(/^,\s*(?:'|")?([^,)\n\r]+?)(?:'|")?\s*\)/);
    const correctAnswer = ansMatch ? ansMatch[1].replace(/^["']|["']$/g, '').trim() : null;

    try {
      const parsed = JSON.parse(jsonStr);
      if (!isRecord(parsed)) continue;

      const questionText = typeof parsed.question_text === 'string' ? parsed.question_text.trim() : '';

      let questionImage: string | undefined;
      if (typeof parsed.question_image === 'string') {
        const img = parsed.question_image.trim();
        if (img !== '' && img !== 'REPLACE_WITH_QUESTION_IMAGE_URL') {
          questionImage = img;
        }
      }

      const options: Array<{ id: string; text: string }> = [];
      if (Array.isArray(parsed.options)) {
        for (const opt of parsed.options) {
          if (isRecord(opt)) {
            const id = typeof opt.id === 'string' ? opt.id.trim() : '';
            const text = typeof opt.text === 'string' ? opt.text.trim() : '';
            if (id) {
              options.push({ id, text });
            }
          }
        }
      }

      questions.push({
        sortOrder,
        questionText,
        questionImage,
        options,
        correctAnswer,
        rawContent: parsed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WARN] Failed to parse JSON in ${path.basename(filePath)} at sort_order ${sortOrder}: ${msg}`);
    }
  }

  return questions;
}

/**
 * Extracts normalized letter suffix (A, B, C, D, E) from option IDs like "q1_1_A", "opt_A", or "A".
 */
export function extractOptionLetter(id: string, index: number): string {
  const match = id.match(/_?([A-E])$/i);
  if (match) return match[1].toUpperCase();
  return String.fromCharCode(65 + index);
}

/**
 * Maps German options to the exact option IDs of the base database row.
 */
export function remapOptionsToDatabaseRow(
  baseContent: unknown,
  gerOptions: Array<{ id: string; text: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(baseContent)) return result;

  const baseOpts = baseContent.options;

  if (Array.isArray(baseOpts)) {
    if (gerOptions.length !== baseOpts.length) {
      console.warn(
        `[remapOptionsToDatabaseRow] Option count mismatch: base has ${baseOpts.length}, translation has ${gerOptions.length}`,
      );
    }

    // Build lookup for base options by letter or index
    const baseLetters = baseOpts.map((opt, idx) => {
      const id = isRecord(opt) && typeof opt.id === 'string'
        ? opt.id.trim()
        : '';
      return { id, letter: extractOptionLetter(id, idx), index: idx };
    });

    for (let i = 0; i < gerOptions.length; i++) {
      const gerOpt = gerOptions[i];
      const gerLetter = extractOptionLetter(gerOpt.id, i);

      // Match by letter first, then fallback to index
      const matchedBase = baseLetters.find((b) => b.letter === gerLetter) ?? baseLetters[i];
      if (matchedBase && matchedBase.id) {
        result[matchedBase.id] = gerOpt.text;
      }
    }
  } else if (isRecord(baseOpts)) {
    const baseKeys = Object.keys(baseOpts);
    if (gerOptions.length !== baseKeys.length) {
      console.warn(
        `[remapOptionsToDatabaseRow] Option count mismatch: base has ${baseKeys.length}, translation has ${gerOptions.length}`,
      );
    }

    for (let i = 0; i < gerOptions.length; i++) {
      const gerOpt = gerOptions[i];
      const gerLetter = extractOptionLetter(gerOpt.id, i);

      const matchedKey = baseKeys.find((k) => extractOptionLetter(k, i) === gerLetter) ?? baseKeys[i];
      if (matchedKey) {
        result[matchedKey] = gerOpt.text;
      }
    }
  }

  return result;
}

/**
 * Normalizes question stems for reliable text comparison.
 */
export function normalizeQuestionStem(text: string): string {
  return text
    .trim()
    .replace(/''/g, "'") // Normalize SQL double single quotes to single quotes
    .replace(/^\d+(\.\d+)?\s*/, '') // Strip question numbering like "1.1 "
    .replace(/\^/g, '') // Normalize e.g. m^3 -> m3, m^2 -> m2
    .replace(/[_]{2,}/g, '______') // Normalize fill-in-the-blank underscores
    .replace(/\s*([=:,\-+*/])\s*/g, ' $1 ') // Normalize spaces around punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Calculates option text similarity score between a DB candidate and the English source question.
 */
export function getOptionMatchScore(
  candidateContent: unknown,
  engOptions: Array<{ id: string; text: string }>
): number {
  if (!isRecord(candidateContent) || engOptions.length === 0) {
    return 0;
  }
  const baseOpts = candidateContent.options;
  if (!Array.isArray(baseOpts)) return 0;

  let score = 0;
  for (let i = 0; i < engOptions.length; i++) {
    const engOptText = engOptions[i].text.trim().toLowerCase();
    if (!engOptText) continue;

    const matched = baseOpts.some((b) => {
      if (!isRecord(b)) return false;
      const bText = typeof b.text === 'string' ? b.text.trim().toLowerCase() : '';
      return bText === engOptText;
    });

    if (matched) score++;
  }

  return score;
}

export interface MatchedQuestionResult {
  dbId: string;
  examTitle: string;
  sectionTitle: string;
  translation: QuestionTranslationItem;
}

export async function buildPaperCoreTranslations(
  client: Client,
  gerBaseDir: string,
  engBaseDir?: string
): Promise<{
  payload: TranslationInputPayload;
  matchedQuestions: MatchedQuestionResult[];
  unmatchedFiles: string[];
  dbQuestionsMap: Map<string, DbQuestionRow>;
  dbSectionsMap: Map<string, DbSectionRow>;
}> {
  // 1. Fetch all Paper questions and sections from DB
  const questionsRes = await client.query<DbQuestionRow & { exam_title: string; section_title: string }>(`
    SELECT 
      q.id, 
      q.question_type, 
      q.content, 
      q.translations,
      e.title as exam_title,
      s.title as section_title
    FROM public.questions q
    JOIN public.sections s ON q.section_id = s.id
    JOIN public.exams e ON s.exam_id = e.id
    WHERE e.format = 'Paper'
  `);

  const sectionsRes = await client.query<DbSectionRow & { exam_format: string }>(`
    SELECT 
      s.id, 
      s.title, 
      s.description, 
      s.question_type, 
      s.environment_content, 
      s.translations,
      e.format as exam_format
    FROM public.sections s
    JOIN public.exams e ON s.exam_id = e.id
    WHERE e.format = 'Paper'
  `);

  const dbQuestionsMap = new Map<string, DbQuestionRow>();
  for (const q of questionsRes.rows) {
    dbQuestionsMap.set(q.id, q);
  }

  const dbSectionsMap = new Map<string, DbSectionRow>();
  for (const s of sectionsRes.rows) {
    dbSectionsMap.set(s.id, s);
  }

  const matchedQuestions: MatchedQuestionResult[] = [];
  const questionTranslations: QuestionTranslationItem[] = [];
  const unmatchedFiles: string[] = [];

  // 2. Scan folders
  const categories: Array<{
    gerDirName: string;
    engDirName: string;
    questionType: string;
  }> = [
    {
      gerDirName: 'Inferring_GER',
      engDirName: 'Inferring',
      questionType: 'inferring_relationships',
    },
    {
      gerDirName: 'Quantitative_GER',
      engDirName: 'Quantitative',
      questionType: 'solving_quantitative',
    },
  ];

  for (const cat of categories) {
    const gerDir = path.join(gerBaseDir, cat.gerDirName);
    if (!fs.existsSync(gerDir)) {
      console.warn(`[WARN] Directory not found: ${gerDir}`);
      continue;
    }

    const engDir = engBaseDir ? path.join(engBaseDir, cat.engDirName) : undefined;
    const gerFiles = fs.readdirSync(gerDir).filter((f) => f.endsWith('.sql'));

    for (const gerFile of gerFiles) {
      const gerPath = path.join(gerDir, gerFile);
      const gerQuestions = parsePaperCoreSql(gerPath);

      // Find counterpart English SQL file to obtain base English questions for exact DB lookup
      let engQuestions: RawParsedQuestion[] = [];
      if (engDir && fs.existsSync(engDir)) {
        const engFile = gerFile.replace(/_GER\.sql$/i, '.sql');
        const engPath = path.join(engDir, engFile);
        if (fs.existsSync(engPath)) {
          engQuestions = parsePaperCoreSql(engPath);
        }
      }

      if (gerQuestions.length === 0) {
        unmatchedFiles.push(gerFile);
        continue;
      }

      for (let i = 0; i < gerQuestions.length; i++) {
        const gerQ = gerQuestions[i];
        const engQ = engQuestions[i];

        // Find candidate matching questions in DB
        const candidates = questionsRes.rows.filter((dbRow) => {
          if (dbRow.question_type !== cat.questionType) return false;
          const c = isRecord(dbRow.content) ? dbRow.content : null;
          if (!c || typeof c.question_text !== 'string') return false;

          const dbStem = normalizeQuestionStem(c.question_text);

          // 1. Direct match on English question text
          if (engQ && engQ.questionText) {
            const engStem = normalizeQuestionStem(engQ.questionText);
            if (dbStem === engStem) return true;

            // Handle table questions where table text was concatenated into question_text
            if (
              engStem.includes('the average number of hours worked per worker is less than 40') &&
              dbStem.includes('the average number of hours worked per worker is less than 40')
            ) {
              return true;
            }
          }

          // 2. Fallback check: sort_order and option count match
          return false;
        });

        if (candidates.length === 0) {
          // If no direct stem match, inspect if DB question matches by sort_order within a known file section
          continue;
        }

        let matchedCandidates = candidates;
        if (candidates.length > 1 && engQ && engQ.options.length > 0) {
          const scored = candidates.map((c) => ({
            candidate: c,
            score: getOptionMatchScore(c.content, engQ.options),
          }));
          const maxScore = Math.max(...scored.map((s) => s.score));
          if (maxScore > 0) {
            matchedCandidates = scored.filter((s) => s.score === maxScore).map((s) => s.candidate);
          }
        }

        for (const candidate of matchedCandidates) {
          const c = isRecord(candidate.content) ? candidate.content : null;
          const baseQText = c && typeof c.question_text === 'string' ? c.question_text : '';
          const hasDbNumbering = /^\d+(\.\d+)?\s*/.test(baseQText);

          let gerQuestionText = gerQ.questionText;
          if (!hasDbNumbering) {
            gerQuestionText = gerQuestionText.replace(/^\d+(\.\d+)?\s*/, '').trim();
          }

          // If the DB base question has embedded context table text and German SQL provides context_text,
          // include the German table text so the full table is translated.
          const rawContext =
            gerQ.rawContent && typeof gerQ.rawContent.context_text === 'string'
              ? gerQ.rawContent.context_text
              : undefined;
          if (
            rawContext &&
            baseQText.includes('Distribution of Work Hours') &&
            !gerQuestionText.includes('Verteilung der Arbeitsstunden')
          ) {
            const parts = gerQuestionText.split('\n\n');
            const promptPart = parts[0];
            const restPart = parts.slice(1).join('\n\n');
            gerQuestionText = `${promptPart}\n\n${rawContext}\n\n${restPart}`;
          }

          const remappedOptions = remapOptionsToDatabaseRow(candidate.content, gerQ.options);

          const item: QuestionTranslationItem = {
            id: candidate.id,
            question_text: gerQuestionText,
          };

          if (Object.keys(remappedOptions).length > 0) {
            item.options = remappedOptions;
          }

          if (gerQ.questionImage) {
            item.question_image = gerQ.questionImage;
          }

          matchedQuestions.push({
            dbId: candidate.id,
            examTitle: candidate.exam_title,
            sectionTitle: candidate.section_title,
            translation: item,
          });

          // Avoid duplicate translation items for the same DB question ID
          if (!questionTranslations.some((qt) => qt.id === candidate.id)) {
            questionTranslations.push(item);
          }
        }
      }
    }
  }

  // 3. Section translations for all Paper Core sections
  const sectionTranslations: SectionTranslationItem[] = [];
  for (const s of sectionsRes.rows) {
    if (!s.question_type) continue;
    const desc = SECTION_TRANSLATIONS[s.question_type];
    if (!desc) continue;

    const sItem: SectionTranslationItem = {
      id: s.id,
      title: desc.deTitle,
    };

    // If base section has non-null/non-empty description (e.g. Paper Test Suit 1), supply German description
    if (typeof s.description === 'string' && s.description.trim() !== '' && desc.deDescription) {
      sItem.description = desc.deDescription;
    }

    sectionTranslations.push(sItem);
  }

  const payload: TranslationInputPayload = {
    lang: 'de',
    questions: questionTranslations,
    sections: sectionTranslations,
  };

  return {
    payload,
    matchedQuestions,
    unmatchedFiles,
    dbQuestionsMap,
    dbSectionsMap,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  const outIndex = args.indexOf('--out');
  const customOutPath = outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : undefined;

  const gerBaseDir = '/Users/rzy/Desktop/ProjectWithTien/Web/testas/PAPER/PaperCore/GER';
  const engBaseDir = '/Users/rzy/Desktop/ProjectWithTien/Web/testas/PAPER/PaperCore/ENGLISH';

  console.log('--- PaperCore German Translation Importer ---');
  console.log(`Source directory: ${gerBaseDir}`);
  console.log(`Mode: ${isApply ? 'APPLY (commit to database)' : 'DRY RUN'}\n`);

  const client = getDbClient();
  await client.connect();

  try {
    const { payload, matchedQuestions, unmatchedFiles, dbQuestionsMap, dbSectionsMap } =
      await buildPaperCoreTranslations(client, gerBaseDir, engBaseDir);

    console.log(`Found ${matchedQuestions.length} matched question instance(s).`);
    console.log(`Total unique question translations: ${payload.questions?.length ?? 0}`);
    console.log(`Total section translations: ${payload.sections?.length ?? 0}`);

    if (unmatchedFiles.length > 0) {
      console.warn(`[WARN] Unmatched or empty files: ${unmatchedFiles.join(', ')}`);
    }

    // Validate using audited processTranslationPayload
    const processResult = processTranslationPayload({
      payload,
      isReviewed: true,
      baseQuestions: dbQuestionsMap,
      basePassages: new Map<string, DbPassageRow>(),
      baseSections: dbSectionsMap,
    });

    if (processResult.issues.length > 0) {
      console.error(`\nValidation failed with ${processResult.issues.length} issue(s):`);
      for (const issue of processResult.issues.slice(0, 10)) {
        console.error(`- [${issue.kind.toUpperCase()} ${issue.id}] ${issue.issues.join('; ')}`);
      }
      if (processResult.issues.length > 10) {
        console.error(`... and ${processResult.issues.length - 10} more.`);
      }
      process.exit(1);
    }

    console.log('\n[PASS] Validation successful: 0 issues found.');

    // Save JSON output
    const defaultOutPath = path.resolve(process.cwd(), 'translations/paper-core-de.json');
    const outputPath = customOutPath ? path.resolve(process.cwd(), customOutPath) : defaultOutPath;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Payload saved to: ${outputPath}`);

    if (!isApply) {
      console.log('\nDry run complete. Use --apply to execute updates against the database.');
      return;
    }

    // Apply updates inside transaction
    console.log('\nApplying translations to database in an atomic transaction...');
    await client.query('BEGIN');

    let updatedQuestions = 0;
    for (const qUp of processResult.questionUpdates) {
      await client.query(
        `UPDATE public.questions
         SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb)
         WHERE id = $2::uuid`,
        [JSON.stringify(qUp.translationWithHash), qUp.id]
      );
      updatedQuestions++;
    }

    let updatedSections = 0;
    for (const sUp of processResult.sectionUpdates) {
      await client.query(
        `UPDATE public.sections
         SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb)
         WHERE id = $2::uuid`,
        [JSON.stringify(sUp.translationWithHash), sUp.id]
      );
      updatedSections++;
    }

    await client.query('COMMIT');
    console.log(`[SUCCESS] Committed ${updatedQuestions} question(s) and ${updatedSections} section(s).`);

    // Verify gaps
    const gapsRes = await client.query<{ section_id: string; title: string; missing_de: number; exam_title: string }>(`
      SELECT s.id as section_id, s.title, g.missing_de, e.title as exam_title
      FROM public.sections s
      JOIN public.section_de_gaps g ON g.section_id = s.id
      JOIN public.exams e ON s.exam_id = e.id
      WHERE e.format = 'Paper'
        AND s.question_type IN ('solving_quantitative', 'inferring_relationships', 'numerical_series', 'completing_patterns')
      ORDER BY g.missing_de DESC
    `);

    const remainingGaps = gapsRes.rows.filter((r) => r.missing_de > 0);
    console.log(`\nCoverage check on Paper Core sections: ${gapsRes.rows.length} total sections checked.`);
    if (remainingGaps.length === 0) {
      console.log('[ALL CLEAR] 100% Paper Core sections have 0 gaps! German is fully unlocked.');
    } else {
      console.warn(`[NOTICE] ${remainingGaps.length} section(s) have remaining gaps:`);
      for (const gap of remainingGaps.slice(0, 10)) {
        console.warn(`  - [${gap.exam_title}] ${gap.title}: ${gap.missing_de} missing item(s)`);
      }
    }
  } catch (err) {
    if (isApply) {
      await client.query('ROLLBACK');
      console.error('[ROLLBACK] Transaction rolled back due to error.');
    }
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
