// Types for the Scorer module - pure calculation domain types

// Alias for compatibility with both DB Section and stored Section
// This allows the Scorer to work with sections from the store (StoredSection)
// or from the DB (Section)
export type SectionType = string;

export interface SectionResult {
  id: string;
  title: string;
  type: string;
  totalQuestions: number;
  actualQuestionIds: string[];
  answeredCount: number;
  correctCount: number;
  percentage: number;
}

export interface GlobalStats {
  totalCorrect: number;
  totalQuestions: number;
  totalAnswered: number;
  overallPercentage: number;
}

export interface DetailedAnswer {
  question_id: string;
  user_answer: any;
  correct_answer: any;
  is_correct: boolean;
}

export interface DetailedResultsBySection {
  [sectionTitle: string]: {
    score: number;
    max_score: number;
    type: string;
    answers: DetailedAnswer[];
  };
}
