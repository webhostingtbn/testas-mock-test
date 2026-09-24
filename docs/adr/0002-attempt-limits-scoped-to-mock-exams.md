# 0002. Attempt Limits Scoped Exclusively to Mock Exams

## Context
Exams have retry limits (`retry_number` on exams or `allow_test_limit` on user profiles) to control how many times a user can take a full test. We needed to decide whether targeted Subtest Drills consume this same quota.

## Decision
Attempt quotas apply strictly to full **Mock Exams** (`WHERE attempt_kind = 'mock'`). **Subtest Drills** are exempt from the exam attempt limit and can be taken without consuming mock test allowances.

## Rationale & Considered Options
We considered a shared quota pool (where any drill consumes an exam attempt) and dedicated drill quotas. We decided on unlimited subtest drills because:
1. Students use subtest drills as formative practice to master weak subtests before attempting an official simulation.
2. Consuming whole-exam quotas on a 20-minute drill would penalize students and lock them out of taking full 3-hour mock tests.
