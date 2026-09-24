# 0003. Subtest Drill Radar and History Integration

## Context
Students use Subtest Drills for targeted skill improvement. We needed to decide how drill attempts interact with student proficiency analytics (radar charts), attempt history, and exam review.

## Decision
1. **Skill Radar Proficiency**: Subtest Drill scores contribute directly to the student's subtest skill radar proficiency ratings, ensuring practice performance is recognized.
2. **Mock Test Metrics Isolation**: Official Mock Exam counters (e.g. tests completed, overall mock exam average) filter strictly by `WHERE section_ids IS NULL`, preventing short drill sessions from deflating full-exam completion statistics.
3. **Unified Review & History**: Drill attempts are accessible in history with a category filter (`All`, `Mock Tests`, `Subtest Drills`) and support question-level review via the standard review interface.

## Rationale & Considered Options
We considered isolating drill results exclusively to the drill tab. We decided on unified radar integration because students drill specifically to elevate weak subtests; rewarding them with visible skill progress on their dashboard radar motivates continued practice while keeping macro test metrics clean.
