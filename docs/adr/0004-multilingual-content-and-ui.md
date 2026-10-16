# 0004. Multilingual Content and UI (EN / DE)

## Context
The client requires English and German only. A student chooses a language as a platform-wide setting that changes both the UI and the question content. Practice ratings, scoring and answer keys must stay shared across languages, and a Mock Exam must feel like the real TestAS, which is taken in one language.

## Decision
1. **Content storage**: `translations jsonb` on `questions`, `passages` and `sections`, with `de` as the only allowed key (DB `CHECK`). English stays in the existing columns as the complete base. Option translations are a map keyed by each question's own option id, so `private.question_answers`, the scoring RPCs and `user_question_practices` are unchanged.
2. **One seam**: a pure module `src/lib/i18n/localize.ts` merges translations server-side, inside `fetchExamById` and `fetchPracticeData`. It uses field-level fallback to English and strips `translations` before data reaches the browser. Rendering components are unaware of languages.
3. **Preference**: `profiles.preferred_language` (nullable) is the source of truth. A `lang` cookie mirrors it for first paint and logged-out pages, and the profile wins when they disagree.
4. **Attempt lock**: `user_exams.language` is set at attempt creation and never changes. An attempt is German only if every text-bearing item in its scope has a German translation (`section_de_gaps` view). Otherwise it runs in English and the student is told.
5. **UI strings**: a hand-written typed dictionary (`messages/en.ts`, `messages/de.ts` typed against `en`), so a missing German key fails the type check. No i18n library and no locale URLs.
6. **Import path**: translations enter only through `scripts/import-translations.ts`, which validates option ids and keys and stores `_source_hash` for staleness checks. It requires `--reviewed` for `linguistic_structures` and `interpreting_texts`.

## Rationale & Considered Options
- **Per-language columns (`*_de`)**: rejected because every language needs a migration and touches every query.
- **Separate `question_translations` table**: deferred. It is the right shape once translator status or review workflow is needed. Because all merging sits behind `localize` and the two fetchers, moving to it later only changes the data layer.
- **Client-side merging**: rejected because merge logic would spread into components and the browser would download every language.
- **Free language switching during an exam**: rejected because it doesn't match the real test, and resume and review would be inconsistent.
- **`next-intl`**: rejected for two fixed languages. The typed dictionary gives compile-time completeness with no dependency.

## Consequences
- German exams need full translation coverage, so partially translated exams stay English-only for German users.
- English edits silently make German stale until `--check-stale` is run.
- Images with baked-in English text need per-language image overrides.
- The root layout reads cookies, so all routes render dynamically.
- The admin panel stays English.
