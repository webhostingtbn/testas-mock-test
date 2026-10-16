# Plan: Multilingual support (EN / DE) for content and UI

Status: ready for execution · Decision record: `docs/adr/0004-multilingual-content-and-ui.md`

This plan is written for an executing agent. Read the whole file first, then work ticket by ticket in the order of the dependency graph. Each ticket lists files, the exact behaviour required, and acceptance checks. Where the plan says **verify**, check the code before writing — those are the places the planner could not fully confirm.

Repo rules that apply to every ticket: `AGENTS.md` (strict TypeScript, no `any`, no unchecked `as`; this is Next.js 16 — read `node_modules/next/dist/docs/` before using `cookies()`, route handlers or layouts), domain terms from `CONTEXT.md`.

---

## 1. Scope

**In scope**

- Two languages only: `en` (base, always complete) and `de`.
- Each user picks a language in a setting. It applies to the whole platform: UI text **and** question content.
- Content translations for `questions`, `passages`, `sections`, stored on the existing rows.
- Mock Exam / Subtest Drill attempts are **locked** to one language for their lifetime.
- An import script for translations, with validation.

**Out of scope** (do not build)

- A third language, locale URLs (`/de/...`), `next-intl` or any i18n library.
- Admin panel translation (`src/app/admin`, `src/components/AdminPanels.tsx`) — stays English.
- Dev preview components under `src/components/magicpath/` and `/kni-preview`.
- Translating images (content team task; the data model supports per-language image overrides).
- Translator workflow / review status UI.

## 2. Fixed decisions (do not revisit)

| # | Decision |
|---|---|
| D1 | Content translations live in a `translations jsonb NOT NULL DEFAULT '{}'` column on `questions`, `passages`, `sections`. Only key allowed: `de`. |
| D2 | Option translations are a **map keyed by the question's own option id** (ids vary: `A` or `q1_A`; never assume a pattern). |
| D3 | All merging happens server-side in one pure module, `src/lib/i18n/localize.ts`. The browser never receives `translations`. Rendering components do not change. |
| D4 | Missing translated field → English base value (field-level fallback). |
| D5 | Scoring RPCs, `private.question_answers`, `user_question_practices` are **not touched**. |
| D6 | `profiles.preferred_language` (nullable) is the source of truth; a `lang` cookie mirrors it for first paint and for logged-out pages. |
| D7 | `user_exams.language` (`en`/`de`, default `en`) is set at attempt creation and never changes. Exam content, exam UI and question review for that attempt use it. Switcher hidden during an exam. |
| D8 | An exam/drill is offered in German only when **every text-bearing item in scope** has a `de` translation. Otherwise the attempt is created in `en` and the UI says so. |
| D9 | UI strings: hand-written typed dictionary, `de` typed against `en` so a missing key fails `tsc`. No fallback for UI strings. |
| D10 | Text subtests `linguistic_structures`, `interpreting_texts` can only be imported with an explicit `--reviewed` flag (human review of answer validity). |
| D11 | Each translation stores `_source_hash` of the English source so stale German can be listed. |

## 3. Data model

### Translation JSON shape

```jsonc
// questions.translations
{ "de": {
    "question_text": "…",
    "question_image": "https://…de.webp",   // optional, only if the image has text
    "options": { "A": "…", "B": "…" },      // keyed by base option id; text only
    "_source_hash": "sha256-hex"
} }

// passages.translations
{ "de": { "title": "…", "body_markdown": "…", "image_url": "…", "_source_hash": "…" } }

// sections.translations
{ "de": { "title": "…", "description": "…", "environment_content": { "text": "…" }, "_source_hash": "…" } }
```

Allowed override keys (anything else is a validation error):

| Table | Keys |
|---|---|
| questions | `question_text`, `question_image`, `options` |
| passages | `title`, `body_markdown`, `image_url` |
| sections | `title`, `description`, `environment_content` (`text`, `images`) |

Keys starting with `_` are metadata and are ignored by `localize`.

### What counts as text-bearing (for D8 coverage)

- question: `btrim(content->>'question_text') <> ''`
- passage: `btrim(body_markdown) <> ''`
- section: `btrim(coalesce(description,'')) <> '' OR btrim(coalesce(environment_content->>'text','')) <> ''`

Non-verbal questions (`figure_sequence`, `latin_square`, `math_equation`, `completing_patterns`, image-only items) are never text-bearing, so they never block German.

---

## 4. Dependency graph

```
T1 migration ──┬──> T3 content fetch ──┐
               │                        ├──> T5 exam language lock
T2 localize ───┤──> T8 import script   │
               │                        │
T1 ────────────┴──> T4 language setting ┴──> T6 UI dictionary ──> T7a..T7f string extraction
T9 docs (independent)
```

T1, T2, T9 can start in parallel.

---

## T1 — Migration and types

**Files**

- New `supabase/migrations/<YYYYMMDDHHMMSS>_add_multilingual_support.sql`
- `src/lib/supabase/database.types.ts` (regenerate with the Supabase CLI; **verify** the command the repo uses — if none, `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`)
- `src/lib/types.ts`, `src/lib/auth/guards.ts` (`UserProfile`)
- Keep `supabase-schema.sql` in sync if it is still maintained (**verify**: compare with the latest migration; the root `migrations/` folder is legacy `00x_` files — do not add there).

**SQL (adapt, keep idempotent)**

```sql
-- 1. translations
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.passages  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sections  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.questions ADD CONSTRAINT questions_translations_shape
  CHECK (jsonb_typeof(translations) = 'object' AND (translations - 'de') = '{}'::jsonb);
-- same constraint for passages, sections

-- 2. user preference (NULL = never chosen)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text
  CHECK (preferred_language IN ('en','de'));

-- 3. attempt language lock
ALTER TABLE public.user_exams ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en','de'));

-- 4. coverage: one row per section with its count of missing German items
CREATE OR REPLACE VIEW public.section_de_gaps AS
SELECT s.id AS section_id, s.exam_id,
  ( (CASE WHEN (btrim(coalesce(s.description,'')) <> '' OR btrim(coalesce(s.environment_content->>'text','')) <> '')
           AND NOT (s.translations ? 'de') THEN 1 ELSE 0 END)
  + (SELECT count(*) FROM public.questions q
      WHERE q.section_id = s.id AND btrim(coalesce(q.content->>'question_text','')) <> ''
        AND NOT (q.translations ? 'de'))
  + (SELECT count(*) FROM public.passages p
      WHERE p.section_id = s.id AND btrim(coalesce(p.body_markdown,'')) <> ''
        AND NOT (p.translations ? 'de'))
  )::int AS missing_de
FROM public.sections s;

REVOKE ALL ON public.section_de_gaps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.section_de_gaps TO service_role;
```

Existing attempts get `language = 'en'` from the default — correct, they were taken in English.

**Types**

- `Question`, `Section` in `types.ts`: add `translations?: ContentTranslations` (type exported from `src/lib/i18n/localize.ts` once T2 lands; until then define it in T2 and import).
- `UserExam`: add `language: Lang`.
- `UserProfile` (guards.ts): add `preferred_language: Lang | null`. `requireUser` already does `select('*')`, so no query change.

**Acceptance**

- Migration applies cleanly on a copy of prod; re-running is a no-op except for the constraints (wrap `ADD CONSTRAINT` in a `DO` block that checks `pg_constraint` if the repo's other migrations do that — **verify** style in `20260924120000_add_subtest_drills_support.sql`).
- `INSERT ... translations = '{"fr":{}}'` fails; `'{"de":{}}'` succeeds.
- `npx tsc --noEmit` passes.

---

## T2 — `localize` module (the core seam)

**Files**

- New `src/lib/i18n/config.ts`
- New `src/lib/i18n/localize.ts`
- New `src/lib/i18n/__tests__/localize.test.ts`
- `package.json` → `"test": "tsx --test src/lib/exam/__tests__/*.test.ts src/lib/i18n/__tests__/*.test.ts"`

**`config.ts`** (no server-only import; used by client and server)

```ts
export const LANGUAGES = ['en', 'de'] as const;
export type Lang = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lang';
export function isLang(value: unknown): value is Lang { /* includes check */ }
```

**`localize.ts` interface** — keep it this small:

```ts
export type ContentTranslations = { de?: QuestionTranslation | PassageTranslation | SectionTranslation };
// (define the three per-table translation types precisely; no `any`)

export function localizeExamData<B extends ExamDataBundle>(bundle: B, lang: Lang): LocalizedBundle<B>;
//  bundle = { sections?: SectionLike[]; passages?: PassageLike[]; questions?: QuestionLike[] }
//  returns the same shape, every row with `translations` REMOVED.

export function findTranslationIssues(
  kind: 'question' | 'passage' | 'section',
  baseRow: unknown,
  translation: unknown,
): string[];   // empty = valid. Used by T8 and tests.

export const REVIEW_REQUIRED_TYPES = ['linguistic_structures', 'interpreting_texts'] as const;
```

**Behaviour**

- `lang === 'en'` → only strip `translations`.
- Question: `content' = { ...content, ...pick(tr, ['question_text','question_image']) }`, then options:
  - base `options` is an **array** of `{ id, text?, image? }` → each option gets `text: tr.options?.[opt.id] ?? opt.text`; order, ids, images unchanged.
  - base `options` is a **record** `{ [id]: string }` → each value becomes `tr.options?.[id] ?? value`.
  - base has no `options` → ignore `tr.options`.
  - option ids in `tr.options` that are not in base are ignored (and reported by `findTranslationIssues`).
- Passage: override `title`, `body_markdown`, `image_url` when present in `tr`.
- Section: override `title`, `description`; `environment_content = { ...base.environment_content, ...tr.environment_content }` when both exist.
- Empty-string translated values count as missing (fallback to English).
- Ignore keys starting with `_`. Never mutate input. Pure: no I/O, no `server-only`.

**`findTranslationIssues` reports**: unknown keys (per table allowlist), non-string values where strings are expected, option ids not in base, empty `question_text`/`body_markdown` when base has text, `environment_content` not an object.

**Tests** (node:test + `assert`, same style as `src/lib/exam/__tests__/practice-filtering.test.ts`):

1. `en` returns rows equal to input minus `translations`.
2. `de` full translation replaces `question_text` and all option texts.
3. Partial options map → missing option keeps English text, array order and length unchanged.
4. Record-shaped options are localized by key.
5. Unknown option id in translation is ignored by localize, reported by `findTranslationIssues`.
6. `question_image` override applies; absent override keeps base image.
7. Non-verbal question (`figure_sequence` content, no translations) is returned unchanged apart from stripping.
8. Passage and section overrides, including `environment_content` merge.
9. `_source_hash` never appears in output.
10. Input objects are not mutated (deep-freeze input).

**Acceptance**: `npm test` green; module has no imports beyond `config.ts` and types.

---

## T3 — Content fetch wiring

**Depends on** T1, T2.

**Files**

- New `src/lib/i18n/server.ts` (`import 'server-only'`)
- `src/lib/data/exams.ts`, `src/lib/data/practice.ts`
- `src/app/api/exams/[id]/route.ts`, `src/app/api/practice/route.ts`

**`server.ts`**

```ts
export async function resolveRequestLang(profile: Pick<UserProfile,'preferred_language'> | null): Promise<Lang>
// order: profile.preferred_language ?? cookie(LANG_COOKIE) ?? DEFAULT_LANG
// uses `await cookies()` from next/headers (Next 16: async — verify in node_modules/next/dist/docs)
```

**`fetchExamById(examId, opts?: { lang?: Lang })`**

- Add `translations` to the `sections`, `passages`, `questions` selects.
- `lang = opts.lang ?? await resolveRequestLang(profile)`.
- Return `localizeExamData({ sections, passages, questions }, lang)` merged with `exam`, plus `lang` in the payload.
- Route `GET /api/exams/[id]`: read `?lang=`; if present and `isLang`, pass it (explicit wins — used by the exam lock in T5); otherwise omit. Invalid value → ignore, do not 400.

**`fetchPracticeData()`**

- Add `translations` to sections/passages/questions selects.
- `lang = await resolveRequestLang(profile)`.
- **Order matters:** localize sections, passages, questions **before** `passageMap` is built and before the `enrichedQuestions` step, so `passage_title` / `passage_markdown` copied into question content are German.
- Return `lang` in the payload.

**Do not** change `updatePracticeRating`, `fetchExams` selects (list page has no translatable text besides section titles — **verify** whether the exam list shows section titles; if yes, include `translations` for sections there too and localize).

**Acceptance**

- With a seeded `de` translation on one question: `/api/practice` returns German text for a user with `preferred_language='de'`, English for `en`, and the JSON contains no `translations` key anywhere (add a test or a quick script check).
- A practice question attached to a translated passage shows the German passage title/markdown.
- `npm test`, `npx tsc --noEmit`, `npm run lint` pass.

---

## T4 — Language setting (cookie + profile + provider + switcher)

**Depends on** T1.

**Files**

- New `src/app/api/language/route.ts`
- `src/app/api/me/route.ts`, `src/lib/data/profiles.ts`
- New `src/components/i18n/LanguageProvider.tsx` (`'use client'`)
- New `src/components/i18n/LanguageSwitcher.tsx`
- `src/app/layout.tsx`
- `src/lib/store/practice-store.ts` (add a `reset()` action)

**Behaviour**

- `PUT /api/language` body `{ lang }`:
  - 400 if `!isLang(lang)`.
  - Always set cookie `lang` (path `/`, 1 year, `sameSite: 'lax'`, `httpOnly: true`, `secure` in prod).
  - If a session exists, update `profiles.preferred_language` (use the admin client like `updateMyProfile`; do **not** add the field to `updateMyProfile`'s editable list — keep one write path).
  - Works logged out (login page switcher).
- `GET /api/me`: if `profile.preferred_language` is `null` and the cookie holds a valid lang → write it to the profile (first login keeps the choice made on the login page). If the profile value differs from the cookie → set the cookie to the profile value on the response. Profile wins.
- `RootLayout` becomes `async`: `const lang = await resolveRequestLang(null)` (cookie only — no auth call in the layout), `<html lang={lang}>`, wrap children in `<LanguageProvider initialLang={lang}>` inside `AuthProvider`.
- `LanguageProvider` context: `{ lang, t, setLanguage(next) }`.
  - `setLanguage`: `PUT /api/language` → on success set state, `usePracticeStore.getState().reset()`, `router.refresh()`.
  - Reconcile: when the user store's profile loads (**verify** where `/api/me` result lands — `src/lib/store/user-store.ts` / `useDashboardData.ts`) and `profile.preferred_language` differs from state, adopt it (no PUT).
- `LanguageSwitcher`: two-option control (`English` / `Deutsch`, labels not translated). Place it (a) on the login page, (b) in the dashboard where the existing profile controls live (`format` / `module_test` are edited via `PATCH /api/me` in `useDashboardData.ts` — put it next to them; **verify** the component). Hidden on `/exam` (T5).
- `practice-store`: add `reset()` that returns state to initial (`isLoaded: false`, empty arrays, `lastFetchedAt: null`). Do **not** add `lang` to the store.

**Note**: reading the cookie in the root layout makes routes dynamic. Accept this; the app is auth-gated and mostly client-rendered.

**Acceptance**

- Logged out: switch to Deutsch on login page → cookie set → after Google sign-in as a new user, `profiles.preferred_language = 'de'`.
- Logged in on a second browser with no cookie → first `/api/me` sets the cookie to the profile value.
- Switching language refreshes practice content without a full reload and without waiting for the 5-minute TTL.

---

## T5 — Exam language lock and German availability

**Depends on** T1, T3, T4.

**Files**

- `src/lib/data/attempts.ts` (`createAttempt`, `getAttempt`, `listAttempts`)
- `src/lib/data/exams.ts` (`fetchExams`: availability)
- `src/lib/exam/orchestrator.ts` (`startExam`, `resumeExam`)
- `src/lib/store/exam-store.ts` (persisted state)
- `src/app/exam/page.tsx` (`fetchQuestionsForSection`)
- The question-level review view for past attempts (ADR 0003 mentions it; **verify** location — likely under `src/app/results` or `src/components/dashboard/`)
- Exam start UI (`TestSelectionView.tsx`, `SubtestDrillsView.tsx` — **verify**)

**Behaviour**

1. Helper in `src/lib/data/exams.ts` (server-only):
   `async function germanAvailable(sectionIds: string[]): Promise<boolean>` → `select missing_de from section_de_gaps where section_id in (...)`; true when the sum is 0.
2. `fetchExams()` adds `languages: Lang[]` per exam (`['en','de']` if all its sections have 0 gaps, else `['en']`). One query for all sections, grouped in TS.
3. `createAttempt()`:
   - `requested = profile.preferred_language ?? 'en'`.
   - Scope = `sectionIds` for drills, all exam sections for mock.
   - `language = requested === 'de' && await germanAvailable(scope) ? 'de' : 'en'`.
   - After `create_attempt_transaction` succeeds, `update user_exams set language = $language where id = <new id>`. (Chosen over changing the RPC signature to avoid touching its REVOKE/GRANT. **Verify** the RPC's return shape to get the id; if the RPC is easy to extend in a new migration, adding `p_language` is acceptable instead.)
   - Return the attempt including `language`.
4. `getAttempt` / `listAttempts`: include `language` in selects.
5. `orchestrator.startExam`: read `attempt.language`, fetch `/api/exams/${examId}?lang=${attempt.language}`, pass `language` into `storeStartExam`.
   `orchestrator.resumeExam`: same with the loaded attempt.
6. `exam-store`: add `language: Lang` to state, `startExam` params, and the persisted partial. Bump the persist `version` and add a `migrate` that defaults missing `language` to `'en'` (**verify** whether the store already has a version).
7. `exam/page.tsx` `fetchQuestionsForSection`: use `?lang=${useExamStore.getState().language}`.
8. During `/exam`: `LanguageSwitcher` not rendered; the `LanguageProvider` uses the exam store's `language` for `t()` while on `/exam` (simplest: in `exam/page.tsx` wrap content in a nested `LanguageProvider initialLang={examLanguage}` with `setLanguage` disabled).
9. Review of a past attempt: fetch exam content with `?lang=${attempt.language}`; UI chrome stays in the user's current language.
10. Start UI: if user language is `de` and the exam's `languages` lacks `de`, show a notice before starting: dictionary key `exam.onlyEnglishAvailable`. Same for drills based on the selected sections (call a tiny `GET /api/exams/[id]/languages?sections=…` **or** compute from data already on the client — choose the simpler after verifying what the drill view has).

**Acceptance**

- User `de` + fully translated exam → attempt `language='de'`, German content, German exam UI.
- User `de` + exam with any gap → attempt `language='en'`, notice shown, English content.
- Switch profile to `en` mid-attempt in another tab, then resume → still German.
- Existing in-progress attempts (pre-migration) resume in English without errors (persisted store without `language`).
- Scoring results for a `de` attempt match an `en` attempt with the same answers.

---

## T6 — UI dictionary and `t()`

**Depends on** T4.

**Files**

- New `src/lib/i18n/messages/en.ts`, `src/lib/i18n/messages/de.ts`, `src/lib/i18n/messages/index.ts`
- New `src/lib/i18n/format.ts`
- `LanguageProvider.tsx` (wire `t`)
- `src/lib/i18n/server.ts` (add `getT()` for server components)

**Shape**

```ts
// en.ts
export const en = {
  common: { next: 'Next', back: 'Back', submit: 'Submit', loading: 'Loading…' },
  exam: { onlyEnglishAvailable: 'This test is only available in English for now.', /* … */ },
} as const;

// index.ts
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
// de.ts
export const de: Messages = { /* same keys, German values */ };
```

- `t(key: MessageKey, vars?: Record<string, string | number>)` where `MessageKey` is the dotted-path union of `Messages`. Interpolation `{name}` only. No plurals — write two keys if needed.
- `format.ts`: `formatDate(date, lang, opts?)`, `formatNumber(n, lang)` using `Intl` with `en-GB` / `de-DE` (**verify** with owner if `en-US` is preferred; default `en-GB`).

**Acceptance**: removing a key from `de.ts` fails `npx tsc --noEmit`.

---

## T7 — String extraction (split into one PR per screen)

**Depends on** T6. Each sub-ticket: replace hard-coded user-visible strings (JSX text, `placeholder`, `aria-label`, `title`, toasts, error messages shown to users, `confirm` texts) with `t()`, add keys to `en.ts` and German to `de.ts`.

| Ticket | Area |
|---|---|
| T7a | Login + gate screens (`src/app/login`, `src/app/page.tsx`, `GateScreens.tsx`) |
| T7b | Dashboard shell + `DashboardView`, `TestSelectionView`, `TestHistoryPanel` |
| T7c | Practice (`PracticeView`, `PracticeSession`) |
| T7d | Subtest Drills (`SubtestDrillsView`) |
| T7e | Exam page + `src/components/question-types/*` + `src/components/exam/*` |
| T7f | Results + review (`src/app/results`, `ReviewView`) |

Rules:

- Replace display-only `toLocale*` calls with `format.ts`. **Do not** touch `toLocaleDateString('en-CA')` in `practice-store.ts` — it builds a date key, not display text. Check every `toLocale*` for the same.
- German strings: produce them, but mark the PR "needs native review" — the owner gets the final word on wording.
- Skip admin and `magicpath` paths.
- Optional `generateMetadata` in layout for title/description — skip unless trivial.

**Acceptance per PR**: screen fully German with `de`, unchanged with `en`; `tsc`, `lint`, `test` pass; grep of the touched files shows no remaining user-visible English literals.

---

## T8 — Translation import script

**Depends on** T1, T2.

**File**: new `scripts/import-translations.ts` (follow `scripts/normalize-question-content.ts`: `dotenv/config` + `pg` `Client`, but type rows properly — no `any`).

**Input file** (`--file path.json`):

```jsonc
{
  "lang": "de",
  "questions": [{ "id": "<uuid>", "question_text": "…", "options": { "A": "…" }, "question_image": "…" }],
  "passages":  [{ "id": "<uuid>", "title": "…", "body_markdown": "…" }],
  "sections":  [{ "id": "<uuid>", "title": "…", "description": "…", "environment_content": { "text": "…" } }]
}
```

**Modes**

- default `--dry-run`: load base rows, run `findTranslationIssues`, print a report (ok / issues per id), write nothing.
- `--apply`: abort if any issue. Otherwise, per row, set `translations = jsonb_set(translations, '{de}', $1::jsonb)` with `_source_hash` added. One transaction.
- `--reviewed`: required if any question's `question_type` is in `REVIEW_REQUIRED_TYPES`; without it those rows are rejected with a clear message.
- `--check-stale`: no input file needed; recompute hash of the current English source for every row that has `de`, print ids whose `_source_hash` differs.

**Hash**: sha256 hex of `JSON.stringify` of the English source fields in a fixed key order (question: `question_text`, option texts by id sorted; passage: `title`, `body_markdown`; section: `title`, `description`, `environment_content.text`). Put the canonicalisation in the script, not in `localize.ts` (keeps `localize` free of `crypto`).

**Acceptance**: dry-run on a sample file with one bad option id reports it and exits non-zero; apply on a clean file writes `de` with hash; editing the English `question_text` makes `--check-stale` list that id.

---

## T9 — Docs

- `docs/adr/0004-multilingual-content-and-ui.md` (already written by the planner — update only if the executor deviates).
- `CONTEXT.md`: add terms
  - **Content Language** — the language a student sees question content in; for an Attempt it is fixed at creation (`user_exams.language`). _Avoid_: locale, translation mode.
  - **Preferred Language** — the student's platform-wide setting (`profiles.preferred_language`) controlling UI and Practice Bank content.
  - **Translation** — a German override of an English base row, stored in `translations.de`; English is always the complete base. _Avoid_: localisation copy, version.

---

## 5. Verification checklist (end of all tickets)

- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- No response from `/api/exams/*` or `/api/practice` contains the key `translations`.
- Manual: login page switch → sign in → dashboard German → practice German with English fallback where untranslated → start fully translated exam (German, switcher hidden) → start partially translated exam (notice, English) → resume both → results/review in the attempt language.
- Scoring unchanged: compare `submit_attempt_transaction_v2` totals for identical answers in `en` and `de` attempts.

## 6. Known risks to watch

- Option ids are inconsistent across question types (`A` vs `q1_A`) and options may be arrays or records — `localize` must handle both; the renderer's `normalizeOptions` in `ModuleMCQ.tsx` already accepts both.
- `practice.ts` passage enrichment must run after localization (T3).
- Persisted exam store from before T5 lacks `language` (T5 step 6).
- Images with baked-in English text need `question_image` / `image_url` overrides; until then German questions show English images.
- Root layout reading cookies → all routes dynamic.
