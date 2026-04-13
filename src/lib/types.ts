// =============================================================
// Shared TypeScript types for the TestAS Mock Test application
// =============================================================

export type MajorType = 'economics' | 'engineering' | 'natural_computer_science';

export type ModuleTestType = 'economics' | 'engineering' | 'natural_computer_science';

export type QuestionType = 'figure_sequence' | 'math_equation' | 'latin_square' | 'module_mcq';

export type ExamStatus = 'not_started' | 'in_progress' | 'completed';

export type SectionStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// ---- Database row types ----

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  major: MajorType | null;
  module_test?: ModuleTestType | null;
  created_at: string;
  updated_at: string;
  role ?: 'user' | 'admin';
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  major: MajorType | null;
  is_active: boolean;
  created_at: string;
}

export interface Section {
  id: string;
  exam_id: string;
  title: string;
  description: string | null;
  question_type: QuestionType;
  duration_seconds: number;
  question_count: number;
  sort_order: number;
  environment_content: EnvironmentContent | null;
  created_at: string;
}

export interface EnvironmentContent {
  text: string;
  images?: string[];
}

export interface Question {
  id: string;
  section_id: string;
  sort_order: number;
  question_type: QuestionType;
  content: FigureSequenceContent | MathEquationContent | LatinSquareContent | ModuleMCQContent;
  correct_answer: unknown;
  created_at: string;
}

export interface UserExam {
  id: string;
  user_id: string;
  exam_id: string;
  status: ExamStatus;
  started_at: string | null;
  completed_at: string | null;
  total_score: number | null;
  max_score: number | null;
  created_at: string;
}

export interface UserSection {
  id: string;
  user_exam_id: string;
  section_id: string;
  status: SectionStatus;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
  created_at: string;
}

export interface UserResponse {
  id: string;
  user_section_id: string;
  question_id: string;
  answer: unknown;
  is_correct: boolean | null;
  answered_at: string;
}

// ---- Question content types ----

export interface FigureSequenceContent {
  /** Array of SVG data URLs or image paths for the sequence */
  sequence_images: string[];
  /** Array of answer option image paths */
  answer_options: string[];
}

export interface MathEquationContent {
  /** Display equations e.g. ["A - B + C = 5", "B + D = 8"] */
  equations: string[];
  /** Variable names the student needs to solve for */
  variables: string[];
}

export interface LatinSquareContent {
  /** 5x5 grid, null = empty cell, "?" = target cell */
  grid: (string | null)[][];
  /** Row index of the "?" cell */
  target_row: number;
  /** Col index of the "?" cell */
  target_col: number;
  /** Available letter options */
  options: string[];
}

export interface ModuleMCQContent {
  /** Question text (can include HTML) */
  question_text: string;
  /** Optional question image URL */
  question_image?: string;
  /** Multiple choice options */
  options: MCQOption[];
}

export interface MCQOption {
  id: string;
  text?: string;
  image?: string;
}

// ---- Answer types ----

export type FigureSequenceAnswer = number;          // Index of selected option
export type MathEquationAnswer = Record<string, number>; // { A: 3, B: 5, ... }
export type LatinSquareAnswer = string;             // Selected letter
export type ModuleMCQAnswer = string;               // Selected option ID

// ---- Exam flow types ----

export interface ExamSection {
  section: Section;
  questions: Question[];
}

export type ExamFlowStep =
  | { type: 'section'; sectionIndex: number }
  | { type: 'break'; duration: number; nextSectionIndex: number };

export interface ExamFlow {
  examId: string;
  userExamId: string;
  steps: ExamFlowStep[];
  sections: ExamSection[];
}
