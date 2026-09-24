# 0001. Unified Exam Attempts with Scoped Section IDs

## Context
Users need the flexibility to take either a full TestAS Mock Exam (all core and module sections with scheduled breaks) or targeted Subtest Drills (a single subtest or custom multi-section groups such as "Core Only"). 

## Decision
We decided to store all test attempts in the existing `user_exams` table, augmented with:
1. `attempt_kind VARCHAR(20) NOT NULL DEFAULT 'mock'` (`'mock' | 'drill'`)
2. `section_ids UUID[] DEFAULT NULL`
3. A CHECK constraint enforcing `CHECK (attempt_kind = 'mock' OR (attempt_kind = 'drill' AND section_ids IS NOT NULL AND cardinality(section_ids) > 0))`

- When `attempt_kind = 'mock'`: The attempt represents a full **Mock Exam** (all active sections).
- When `attempt_kind = 'drill'`: The attempt represents a **Subtest Drill** scoped strictly to the specified sections.

> **v1 Scope Note**: While the underlying database schema permits multi-section arrays (`cardinality(section_ids) > 0`), the v1 API and RPC layer intentionally enforce single-section drill selection (`cardinality(section_ids) = 1`). Multi-section drills (e.g. "Core Only") are deferred to avoid premature UX complexity and prevent piecemeal mock exam evasion.

## Rationale & Considered Options
We considered creating a separate `user_section_attempts` table or an intermediate `user_exam_sections` join table. We chose a single table with an explicit `attempt_kind` and `section_ids UUID[]` because:
1. **Explicit Semantics**: Adding `attempt_kind` prevents ambiguous `NULL` vs `'{}'` array states and makes downstream queries completely self-documenting.
2. **Unified Lifecycle**: State transitions (`in_progress` -> `completed`), timestamps, user answers, and scoring follow the exact same lifecycle.
3. **Zero Code Duplication**: Reuses existing Row Level Security (RLS) policies, session endpoints (`/api/attempts`), and the `/exam` runner interface.
4. **Flexible Scope**: Supports single-section drills today, with schema-level readiness for multi-section subsets in future phases without migrations.
