import "dotenv/config";
import { Client } from "pg";
import fs from "fs";

type QuestionRow = {
  id: string;
  question_type: string;
  sort_order: number;
  content: any;
  correct_answer: any;
};

type NormalizedResult = {
  id: string;
  question_type: string;
  sort_order: number;
  changed: boolean;
  before: {
    content: any;
    correct_answer: any;
  };
  after?: {
    content: any;
    correct_answer: any;
  };
  errors: string[];
  warnings: string[];
};

const MCQ_TYPES = [
  "solving_quantitative",
  "inferring_relationships",
  "sc_1",
  "sc_2",
  "econ_1",
  "eng_3",
  "eng_2_2d",
  "eng_2_3d",
  "module_mcq",
];

const args = process.argv.slice(2);

const APPLY = args.includes("--apply");
const APPLY_VALID = args.includes("--apply-valid");
const ALLOW_NEEDS_REVIEW = args.includes("--allow-needs-review");

const OUT_FILE =
  getArgValue("--out") ?? "normalize-question-content-report.json";

const LIMIT = getArgValue("--limit")
  ? Number(getArgValue("--limit"))
  : undefined;

const QUESTION_TYPE_FILTERS = getRepeatedArgValues("--question-type");
const ID_FILTERS = getRepeatedArgValues("--id");

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in .env");
}

function getArgValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function getRepeatedArgValues(name: string): string[] {
  const values: string[] = [];

  args.forEach((arg, index) => {
    if (arg === name && args[index + 1]) {
      values.push(args[index + 1]);
    }
  });

  return values;
}

function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function optionIndexToLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function extractOptionLetter(raw: any): string | null {
  if (typeof raw !== "string") return null;

  const value = raw.trim().replace(/^"|"$/g, "");

  if (/^[A-E]$/.test(value)) return value;

  const match = value.match(/_([A-E])$/);
  if (match) return match[1];

  if (value === "NEEDS_REVIEW") return value;

  return null;
}

function extractMarkdownImageUrl(value: string): string | null {
  const match = value.match(/!\[[^\]]*]\(([^)]+)\)/);
  return match?.[1] ?? null;
}

function normalizeOptionValue(
  id: string,
  value: any,
  errors: string[],
  warnings: string[]
): any {
  if (typeof value === "string") {
    const imageUrl = extractMarkdownImageUrl(value);

    if (imageUrl) {
      return {
        id,
        image_url: imageUrl,
      };
    }

    return {
      id,
      text: value,
    };
  }

  if (isPlainObject(value)) {
    const output: any = { id };

    const directImageUrl =
      typeof value.image_url === "string"
        ? value.image_url
        : typeof value.option_image === "string"
          ? value.option_image
          : null;

    const text =
      typeof value.text === "string"
        ? value.text
        : typeof value.label === "string"
          ? value.label
          : null;

    if (directImageUrl) {
      output.image_url = directImageUrl;
    } else if (text) {
      const markdownImageUrl = extractMarkdownImageUrl(text);

      if (markdownImageUrl) {
        output.image_url = markdownImageUrl;
      } else {
        output.text = text;
      }
    }

    if (!output.text && !output.image_url) {
      errors.push(`Option ${id} has no text or image_url`);
    }

    return output;
  }

  errors.push(`Option ${id} has unsupported value type`);
  warnings.push(`Option ${id} value: ${JSON.stringify(value)}`);

  return {
    id,
    text: String(value),
  };
}

function normalizeOptions(
  options: any,
  errors: string[],
  warnings: string[]
): any[] | null {
  if (Array.isArray(options)) {
    const normalized = options.map((option, index) => {
      const fallbackId = optionIndexToLetter(index);

      if (isPlainObject(option)) {
        const id = extractOptionLetter(option.id) ?? fallbackId;

        if (!extractOptionLetter(option.id)) {
          warnings.push(
            `Option at index ${index} missing clean id. Used fallback ${fallbackId}`
          );
        }

        if (typeof option.image_url === "string") {
          return normalizeOptionValue(
            id,
            { image_url: option.image_url, text: option.text },
            errors,
            warnings
          );
        }

        if (typeof option.text === "string") {
          return normalizeOptionValue(id, option.text, errors, warnings);
        }

        return normalizeOptionValue(id, option, errors, warnings);
      }

      return normalizeOptionValue(fallbackId, option, errors, warnings);
    });

    return sortOptions(normalized);
  }

  if (isPlainObject(options)) {
    const normalized = Object.entries(options).map(([key, value]) => {
      const id = extractOptionLetter(key) ?? key;

      if (!/^[A-E]$/.test(id)) {
        errors.push(`Invalid option key: ${key}`);
      }

      return normalizeOptionValue(id, value, errors, warnings);
    });

    return sortOptions(normalized);
  }

  errors.push("content.options must be array or object");
  return null;
}

function sortOptions(options: any[]): any[] {
  const order: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
  };

  return [...options].sort((a, b) => {
    return (order[a.id] ?? 99) - (order[b.id] ?? 99);
  });
}

function normalizeCorrectAnswer(
  correctAnswer: any,
  errors: string[],
  warnings: string[]
): string | null {
  if (typeof correctAnswer === "string") {
    const letter = extractOptionLetter(correctAnswer);

    if (!letter) {
      errors.push(`Cannot normalize correct_answer: ${correctAnswer}`);
      return null;
    }

    return letter;
  }

  if (correctAnswer === null || correctAnswer === undefined) {
    if (ALLOW_NEEDS_REVIEW) {
      warnings.push("correct_answer is null. Used NEEDS_REVIEW.");
      return "NEEDS_REVIEW";
    }

    errors.push("correct_answer is null");
    return null;
  }

  errors.push(
    `correct_answer must be JSON string for MCQ. Found ${JSON.stringify(
      correctAnswer
    )}`
  );

  return null;
}

function normalizeQuestion(row: QuestionRow): NormalizedResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const oldContent = row.content;
  const oldCorrectAnswer = row.correct_answer;

  if (!isPlainObject(oldContent)) {
    errors.push("content is not JSON object");

    return {
      id: row.id,
      question_type: row.question_type,
      sort_order: row.sort_order,
      changed: false,
      before: {
        content: oldContent,
        correct_answer: oldCorrectAnswer,
      },
      errors,
      warnings,
    };
  }

  const newContent = deepClone(oldContent);

  const imageSource =
    typeof newContent.question_image === "string"
      ? newContent.question_image
      : typeof newContent.image_url === "string"
        ? newContent.image_url
        : typeof newContent.question_url === "string"
          ? newContent.question_url
          : null;

  delete newContent.image_url;
  delete newContent.question_url;

  if (imageSource) {
    newContent.question_image = imageSource;
  } else if (newContent.question_image === null) {
    delete newContent.question_image;
  }

  const normalizedOptions = normalizeOptions(
    newContent.options,
    errors,
    warnings
  );

  if (normalizedOptions) {
    newContent.options = normalizedOptions;
  }

  const newCorrectAnswer = normalizeCorrectAnswer(
    oldCorrectAnswer,
    errors,
    warnings
  );

  if (normalizedOptions && newCorrectAnswer && newCorrectAnswer !== "NEEDS_REVIEW") {
    const optionIds = normalizedOptions.map((option) => option.id);

    if (!optionIds.includes(newCorrectAnswer)) {
      errors.push(
        `correct_answer ${newCorrectAnswer} does not exist in options [${optionIds.join(
          ", "
        )}]`
      );
    }
  }

  if (normalizedOptions) {
    const seen = new Set<string>();

    for (const option of normalizedOptions) {
      if (!/^[A-E]$/.test(option.id)) {
        errors.push(`Invalid normalized option id: ${option.id}`);
      }

      if (seen.has(option.id)) {
        errors.push(`Duplicate option id: ${option.id}`);
      }

      seen.add(option.id);

      if (typeof option.text !== "string" && typeof option.image_url !== "string") {
        errors.push(`Option ${option.id} missing text or image_url`);
      }
    }
  }

  const changed =
    stableStringify(oldContent) !== stableStringify(newContent) ||
    stableStringify(oldCorrectAnswer) !== stableStringify(newCorrectAnswer);

  return {
    id: row.id,
    question_type: row.question_type,
    sort_order: row.sort_order,
    changed,
    before: {
      content: oldContent,
      correct_answer: oldCorrectAnswer,
    },
    after: {
      content: newContent,
      correct_answer: newCorrectAnswer,
    },
    errors,
    warnings,
  };
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const selectedTypes =
    QUESTION_TYPE_FILTERS.length > 0 ? QUESTION_TYPE_FILTERS : MCQ_TYPES;

  for (const type of selectedTypes) {
    if (!MCQ_TYPES.includes(type)) {
      throw new Error(
        `Invalid question type filter: ${type}. Allowed: ${MCQ_TYPES.join(", ")}`
      );
    }
  }

  const whereClauses = [`question_type::text = ANY($1::text[])`];
  const params: any[] = [selectedTypes];

  if (ID_FILTERS.length > 0) {
    params.push(ID_FILTERS);
    whereClauses.push(`id::text = ANY($${params.length}::text[])`);
  }

  let sql = `
    SELECT
      id::text,
      question_type::text,
      sort_order,
      content,
      correct_answer
    FROM public.questions
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY question_type::text, sort_order ASC
  `;

  if (LIMIT && Number.isFinite(LIMIT)) {
    params.push(LIMIT);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await client.query<QuestionRow>(sql, params);

  const reports = result.rows.map(normalizeQuestion);

  const changed = reports.filter((report) => report.changed);
  const invalid = reports.filter((report) => report.errors.length > 0);
  const validChanged = changed.filter((report) => report.errors.length === 0);

  const reportPayload = {
    mode: APPLY ? "apply" : "dry-run",
    selected_types: selectedTypes,
    total_rows_scanned: reports.length,
    changed_rows: changed.length,
    valid_changed_rows: validChanged.length,
    invalid_rows: invalid.length,
    invalid_ids: invalid.map((report) => report.id),
    reports,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(reportPayload, null, 2));

  console.log(`Scanned rows: ${reports.length}`);
  console.log(`Changed rows: ${changed.length}`);
  console.log(`Valid changed rows: ${validChanged.length}`);
  console.log(`Invalid rows: ${invalid.length}`);
  console.log(`Report written: ${OUT_FILE}`);

  console.log("\nSample changed rows:");
  for (const item of validChanged.slice(0, 5)) {
    console.log("\n---");
    console.log(`id: ${item.id}`);
    console.log(`type: ${item.question_type}`);
    console.log(`sort_order: ${item.sort_order}`);
    console.log("before:", JSON.stringify(item.before, null, 2));
    console.log("after:", JSON.stringify(item.after, null, 2));
  }

  if (!APPLY) {
    console.log("\nDry run only. Add --apply to update database.");
    await client.end();
    return;
  }

  if (invalid.length > 0 && !APPLY_VALID) {
    console.log(
      "\nApply aborted because invalid rows exist. Review report first, or use --apply --apply-valid to update only valid rows."
    );

    await client.end();
    process.exit(1);
  }

  await client.query("BEGIN");

  try {
    const backupTableName = `questions_backup_before_normalize_${new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14)}`;

    await client.query(`
      CREATE TABLE public.${backupTableName} AS
      SELECT *
      FROM public.questions;
    `);

    console.log(`Backup created: public.${backupTableName}`);

    for (const item of validChanged) {
      if (!item.after) continue;

      await client.query(
        `
          UPDATE public.questions
          SET
            content = $1::jsonb,
            correct_answer = $2::jsonb
          WHERE id = $3::uuid
        `,
        [
          JSON.stringify(item.after.content),
          JSON.stringify(item.after.correct_answer),
          item.id,
        ]
      );
    }

    await client.query("COMMIT");

    console.log(`Updated rows: ${validChanged.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});