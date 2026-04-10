// =============================================================
// Mock Question Data for Development/Testing
// =============================================================
// This file provides sample questions for all 4 question types.
// Replace with real data from Supabase when ready.
//
// HOW TO ADD REAL DATA:
// 1. Insert questions into the `questions` table in Supabase
// 2. Each question has a `content` JSONB field matching the shapes below
// 3. Each question has a `correct_answer` JSONB field for auto-grading
// 4. Link questions to sections via `section_id`
//
// CONTENT SHAPES BY TYPE:
// - figure_sequence: { sequence_images: string[], answer_options: string[] }
// - math_equation:   { equations: string[], variables: string[] }
// - latin_square:    { grid: (string|null)[][], target_row: number, target_col: number, options: string[] }
// - module_mcq:      { question_text: string, question_image?: string, environment_text?: string, options: {id, text?, image?}[] }
// =============================================================

interface MockQuestion {
  id: string;
  content: Record<string, unknown>;
  correct_answer: unknown;
}

// ---- FIGURE SEQUENCE QUESTIONS ----
function generateFigureSequenceQuestions(count: number): MockQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-fig-${i + 1}`,
    content: {
      sequence_images: [
        `pattern-${i}-0`,
        `pattern-${i}-1`,
        `pattern-${i}-2`,
        `pattern-${i}-3`,
      ],
      answer_options: [
        `option-${i}-A`,
        `option-${i}-B`,
        `option-${i}-C`,
        `option-${i}-D`,
        `option-${i}-E`,
        `option-${i}-F`,
        `option-${i}-G`,
        `option-${i}-H`,
      ],
    },
    correct_answer: Math.floor(Math.random() * 8), // Random correct answer index
  }));
}

// ---- MATH EQUATION QUESTIONS ----
const mathEquationSets = [
  { equations: ['A + B = 7', 'A - B = 3'], variables: ['A', 'B'] },
  { equations: ['A × B = 12', 'A + B = 7'], variables: ['A', 'B'] },
  { equations: ['A + B + C = 10', 'A - C = 2', 'B = 3'], variables: ['A', 'B', 'C'] },
  { equations: ['2A + B = 10', 'A + 2B = 8'], variables: ['A', 'B'] },
  { equations: ['A × 3 = 15', 'B - A = 2'], variables: ['A', 'B'] },
  { equations: ['A + B = 12', 'C = A - B', 'A = 8'], variables: ['A', 'B', 'C'] },
  { equations: ['A + B + C + D = 20', 'A = D', 'B = C', 'A + B = 12'], variables: ['A', 'B', 'C', 'D'] },
  { equations: ['3A = 9', 'B = A + 4'], variables: ['A', 'B'] },
  { equations: ['A - B = 5', 'A + B = 13'], variables: ['A', 'B'] },
  { equations: ['A × B = 20', 'A = 4'], variables: ['A', 'B'] },
];

function generateMathEquationQuestions(count: number): MockQuestion[] {
  return Array.from({ length: count }, (_, i) => {
    const set = mathEquationSets[i % mathEquationSets.length];
    return {
      id: `q-math-${i + 1}`,
      content: {
        equations: set.equations,
        variables: set.variables,
      },
      correct_answer: Object.fromEntries(set.variables.map((v) => [v, Math.floor(Math.random() * 10)])),
    };
  });
}

// ---- LATIN SQUARE QUESTIONS ----
const latinSquareGrids = [
  {
    grid: [
      ['A', 'B', 'C', 'D', 'E'],
      ['B', 'C', 'D', 'E', 'A'],
      ['C', 'D', null, 'A', 'B'],
      ['D', 'E', 'A', 'B', 'C'],
      ['E', 'A', 'B', 'C', 'D'],
    ],
    target_row: 2,
    target_col: 2,
    correct: 'E',
  },
  {
    grid: [
      ['C', 'A', 'E', 'B', 'D'],
      ['A', null, 'B', 'D', 'C'],
      ['E', 'B', 'D', 'C', 'A'],
      ['B', 'D', 'C', 'A', 'E'],
      ['D', 'C', 'A', 'E', 'B'],
    ],
    target_row: 1,
    target_col: 1,
    correct: 'E',
  },
  {
    grid: [
      ['D', 'B', 'E', 'A', 'C'],
      ['B', 'E', 'A', 'C', 'D'],
      ['E', 'A', 'C', 'D', 'B'],
      ['A', 'C', 'D', 'B', null],
      ['C', 'D', 'B', 'E', 'A'],
    ],
    target_row: 3,
    target_col: 4,
    correct: 'E',
  },
  {
    grid: [
      [null, 'E', 'A', 'C', 'B'],
      ['E', 'A', 'C', 'B', 'D'],
      ['A', 'C', 'B', 'D', 'E'],
      ['C', 'B', 'D', 'E', 'A'],
      ['B', 'D', 'E', 'A', 'C'],
    ],
    target_row: 0,
    target_col: 0,
    correct: 'D',
  },
  {
    grid: [
      ['B', 'D', 'A', 'E', 'C'],
      ['D', 'A', 'E', 'C', 'B'],
      ['A', 'E', 'C', null, 'D'],
      ['E', 'C', 'B', 'D', 'A'],
      ['C', 'B', 'D', 'A', 'E'],
    ],
    target_row: 2,
    target_col: 3,
    correct: 'B',
  },
];

function generateLatinSquareQuestions(count: number): MockQuestion[] {
  return Array.from({ length: count }, (_, i) => {
    const data = latinSquareGrids[i % latinSquareGrids.length];
    // Create a display grid with '?' at the target position
    const displayGrid = data.grid.map((row, rIdx) =>
      row.map((cell, cIdx) =>
        rIdx === data.target_row && cIdx === data.target_col ? '?' : cell
      )
    );

    return {
      id: `q-latin-${i + 1}`,
      content: {
        grid: displayGrid,
        target_row: data.target_row,
        target_col: data.target_col,
        options: ['A', 'B', 'C', 'D', 'E'],
      },
      correct_answer: data.correct,
    };
  });
}

// ---- MODULE MCQ QUESTIONS ----
function generateModuleMCQQuestions(count: number): MockQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-module-${i + 1}`,
    content: {
      environment_text: `A company produces widgets and gadgets. In Q${i + 1} of 2024, total production was ${1000 + i * 50} units. The widget-to-gadget ratio was ${3 + (i % 3)}:${2 + (i % 2)}. Production costs averaged $${(15 + i * 0.5).toFixed(2)} per unit. The company aims to increase production by ${5 + i}% next quarter while reducing per-unit costs by 3%.`,
      environment_images: [],
      question_text: `Based on the production data described above, what would be the expected total number of widgets produced in Q${i + 2} of 2024 if the company meets its growth target?`,
      question_image: undefined,
      options: [
        { id: `opt-${i}-a`, text: `${600 + i * 30} widgets` },
        { id: `opt-${i}-b`, text: `${650 + i * 30} widgets` },
        { id: `opt-${i}-c`, text: `${700 + i * 30} widgets` },
        { id: `opt-${i}-d`, text: `${750 + i * 30} widgets` },
      ],
    },
    correct_answer: `opt-${i}-b`,
  }));
}

// ---- MAIN EXPORT ----
export function getMockQuestions(questionType: string, count: number): MockQuestion[] {
  switch (questionType) {
    case 'figure_sequence':
      return generateFigureSequenceQuestions(count);
    case 'math_equation':
      return generateMathEquationQuestions(count);
    case 'latin_square':
      return generateLatinSquareQuestions(count);
    case 'module_mcq':
      return generateModuleMCQQuestions(count);
    default:
      return [];
  }
}
