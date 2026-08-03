'use client';

import { create } from 'zustand';

export interface PracticeSection {
  id: string;
  exam_id: string;
  title: string;
  description?: string;
  question_type: string;
  duration_seconds: number;
  question_count: number;
  sort_order: number;
  environment_content?: unknown;
  created_at: string;
  exams?: { title?: string } | Array<{ title?: string }>;
}

export interface PracticeQuestionItem {
  id: string;
  section_id: string;
  sort_order: number;
  question_type: string;
  content: unknown;
  passage_id?: string | null;
  created_at: string;
  isPassage?: boolean;
  questions?: PracticeQuestionItem[];
  [key: string]: unknown;
}

export interface UserQuestionPracticeRow {
  user_id: string;
  question_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  updated_at?: string;
}

interface PracticeState {
  sections: PracticeSection[];
  questions: PracticeQuestionItem[];
  userRatings: Record<string, 'easy' | 'medium' | 'hard'>;
  userPracticeDates: string[];
  isLoaded: boolean;
  isLoading: boolean;
  lastFetchedAt: number | null;
  error: string | null;

  fetchPracticeData: (options?: { force?: boolean }) => Promise<void>;
  updateRating: (questionIds: string[], difficulty: 'easy' | 'medium' | 'hard') => Promise<void>;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sections: [],
  questions: [],
  userRatings: {},
  userPracticeDates: [],
  isLoaded: false,
  isLoading: false,
  lastFetchedAt: null,
  error: null,

  fetchPracticeData: async (options) => {
    const { isLoaded, isLoading, lastFetchedAt } = get();
    const now = Date.now();

    if (isLoaded && !options?.force && lastFetchedAt && now - lastFetchedAt < 5 * 60 * 1000) {
      return;
    }

    if (!isLoaded) {
      set({ isLoading: true, error: null });
    }

    try {
      const res = await fetch('/api/practice');
      if (!res.ok) throw new Error('Failed to fetch practice data');
      const data = await res.json();

      const sections = (data.sections || []) as PracticeSection[];
      const questions = (data.questions || []) as PracticeQuestionItem[];
      const userPractices = (data.userPractices || []) as UserQuestionPracticeRow[];

      const userRatings: Record<string, 'easy' | 'medium' | 'hard'> = {};
      const dateSet = new Set<string>();

      userPractices.forEach((row) => {
        userRatings[row.question_id] = row.difficulty;
        if (row.updated_at) {
          const dateStr = new Date(row.updated_at).toLocaleDateString('en-CA');
          dateSet.add(dateStr);
        }
      });

      set({
        sections,
        questions,
        userRatings,
        userPracticeDates: Array.from(dateSet),
        isLoaded: true,
        isLoading: false,
        lastFetchedAt: Date.now(),
        error: null,
      });
    } catch (err) {
      console.error('Failed to load practice store data:', err);
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load practice data',
      });
    }
  },

  updateRating: async (questionIds: string[], difficulty: 'easy' | 'medium' | 'hard') => {
    if (questionIds.length === 0) return;

    const todayStr = new Date().toLocaleDateString('en-CA');

    set((state) => {
      const nextRatings = { ...state.userRatings };
      questionIds.forEach((qId) => {
        nextRatings[qId] = difficulty;
      });
      const nextDatesSet = new Set(state.userPracticeDates);
      nextDatesSet.add(todayStr);

      return {
        userRatings: nextRatings,
        userPracticeDates: Array.from(nextDatesSet),
      };
    });

    try {
      for (const qId of questionIds) {
        await fetch(`/api/practice/${qId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty }),
        });
      }
    } catch (err) {
      console.error('Failed to sync practice rating to database:', err);
    }
  },
}));
