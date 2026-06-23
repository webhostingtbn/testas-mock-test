# TestAS Mock CMS - Templates and SQL Generator

## Overview

This directory contains templates and tools for creating questions and exams for the TestAS Mock system.

## Quick Start for Admins

### To Add a New Question:

1. **Find the appropriate template** in `templates/` based on question type
2. **Copy the template** and fill in your values
3. **Generate SQL** using the template (see below)
4. **Run SQL** in your Supabase database

### To Add a Complete Exam:

1. **Copy `templates/exam_template.json`**
2. **Fill in exam details** (title, sections, questions)
3. **Generate SQL** from the JSON
4. **Run SQL** in your Supabase database

---

## Question Type Reference

### Core Questions (Digital)
| Template | Description |
|----------|-------------|
| `figure_sequence.json` | Visual sequence completion |
| `math_equation.json` | Solve systems of equations |
| `latin_square.json` | Find missing letter in 5x5 grid |

### Core Questions (Paper)
| Template | Description |
|----------|-------------|
| `solving_quantitative.json` | Quantitative problem solving |
| `inferring_relationships.json` | Relationship inference |
| `completing_patterns.json` | Pattern completion |
| `numerical_series.json` | Complete number series |

### Module Questions (Digital - Passage-based)
| Template | Description |
|----------|-------------|
| `module_mcq.json` | Multiple choice with passage |
| `interpreting_texts.json` | Text interpretation |
| `representation_systems.json` | Representation systems |
| `linguistic_structures.json` | Linguistics questions |

### Module Questions (Paper - Direct)
| Template | Description |
|----------|-------------|
| `sc_1.json` | Science module question 1 |
| `sc_2.json` | Science module question 2 |
| `eng_1.json` | Engineering module question 1 |
| `eng_2_2d.json` | Engineering 2D question |
| `eng_2_3d.json` | Engineering 3D question |
| `eng_3.json` | Engineering advanced |
| `econ_1.json` | Economics question 1 |
| `econ_2.json` | Economics question 2 |

---

## Template Structure

### Question Template
```json
{
  "id": "generate-uuid-v4",
  "section_id": "section-uuid-here",
  "sort_order": 1,
  "question_type": "figure_sequence",
  "content": {
    // Type-specific content
  },
  "correct_answer": {
    // Type-specific answer
  },
  "created_at": "2026-06-23T10:00:00Z"
}
```

### Exam Template
```json
{
  "exam": {
    "id": "generate-uuid-v4",
    "title": "Exam Title",
    "format": "Digital",
    "major": "natural_computer_science",
    "is_active": true
  },
  "sections": [
    {
      "title": "Section Name",
      "question_type": "figure_sequence",
      "duration_seconds": 1200,
      "question_count": 15
    }
  ],
  "questions": [
    {
      "section_id": "section-uuid",
      "question_type": "figure_sequence",
      "content": {...},
      "correct_answer": {...}
    }
  ]
}
```

---

## Generating SQL

### Method 1: Manual SQL from Template

For each question template, generate SQL like this:

```sql
INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  'section-uuid-here',
  1,
  'figure_sequence',
  '{"sequence_images": [...], "answer_options": [...]}',
  '{"image1": 1, "image2": 2}'
);
```

### Method 2: Using the SQL Generator

The `sql-generator.ts` file provides functions to generate SQL from JSON:

```typescript
import { generateSQLFromJSON } from '@/lib/cms/sql-generator';

const examJSON = { /* your exam data */ };
const sql = generateSQLFromJSON(examJSON);
console.log(sql);
```

### Method 3: Direct Database Insert

For simple questions, insert directly:

```sql
-- Figure Sequence
INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  'YOUR_SECTION_ID',
  1,
  'figure_sequence',
  '{"sequence_images": ["url1", "url2", "url3"], "answer_options": ["opt1", "opt2", "opt3"]}',
  '{"image1": 1, "image2": 2}'
);

-- Math Equation
INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  'YOUR_SECTION_ID',
  1,
  'math_equation',
  '{"equations": ["A + B = 10", "A - B = 4"], "variables": ["A", "B"]}',
  '{"A": 7, "B": 3}'
);
```

---

## Database Schema

### `exams` Table
```sql
CREATE TABLE public.exams (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  major TEXT,
  format TEXT NOT NULL DEFAULT 'Digital',
  is_active BOOLEAN DEFAULT TRUE,
  retry_number SMALLINT,
  created_at TIMESTAMPTZ
);
```

### `sections` Table
```sql
CREATE TABLE public.sections (
  id UUID PRIMARY KEY,
  exam_id UUID REFERENCES exams(id),
  title TEXT NOT NULL,
  description TEXT,
  question_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  environment_content JSONB,
  created_at TIMESTAMPTZ
);
```

### `questions` Table
```sql
CREATE TABLE public.questions (
  id UUID PRIMARY KEY,
  section_id UUID REFERENCES sections(id),
  sort_order INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  content JSONB NOT NULL,
  correct_answer JSONB NOT NULL,
  created_at TIMESTAMPTZ
);
```

---

## Common Patterns

### Adding Multiple Questions to Same Section

```sql
-- First, get section ID
SELECT id FROM public.sections WHERE title = 'Core - Figure Sequences';

-- Then insert questions with that section_id
INSERT INTO public.questions (...) VALUES (section_id, ...);
INSERT INTO public.questions (...) VALUES (section_id, ...);
```

### Updating an Existing Question

```sql
UPDATE public.questions
SET content = '{"new": "content"}',
    correct_answer = '{"new": "answer"}'
WHERE id = 'question-uuid-here';
```

### Deactivating an Exam

```sql
UPDATE public.exams SET is_active = FALSE WHERE id = 'exam-uuid';
```

### Activating an Exam (and deactivating others)

```sql
-- Deactivate all exams of same format
UPDATE public.exams SET is_active = FALSE WHERE format = 'Digital';

-- Activate target exam
UPDATE public.exams SET is_active = TRUE WHERE id = 'exam-uuid';
```

---

## Troubleshooting

### "foreign key violation" error
Make sure the `section_id` exists in the `sections` table before inserting questions.

### "invalid input for JSONB" error
Escape single quotes in JSON strings: `'` → `''`

### UUID already exists
Use `gen_random_uuid()` instead of hard-coded UUIDs, or generate new ones.

---

## Support

For questions about:
- Question structure → Check `src/lib/types.ts`
- Question rendering → Check `src/components/question-types/`
- Exam flow → Check `src/lib/exam/orchestrator.ts`
