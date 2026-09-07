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

export interface PracticePassage {
  id: string;
  section_id: string;
  title: string;
  body_markdown: string;
  image_url?: string | null;
}

interface PracticeState {
  sections: PracticeSection[];
  questions: PracticeQuestionItem[];
  passages: PracticePassage[];
  userRatings: Record<string, 'easy' | 'medium' | 'hard'>;
  userPracticeDates: string[];
  isLoaded: boolean;
  isLoading: boolean;
  lastFetchedAt: number | null;
  error: string | null;

  fetchPracticeData: (options?: { force?: boolean }) => Promise<void>;
  refreshRatings: () => Promise<void>;
  updateRating: (questionIds: string[], difficulty: 'easy' | 'medium' | 'hard') => Promise<void>;
}

// Module-scope fetch coordination: dedupes concurrent callers (dashboard
// prefetch + view mount + StrictMode). Only one full fetch runs at a time,
// so a stale response can never overwrite fresher state.
let inFlightFetch: Promise<void> | null = null;
let inFlightRefresh: Promise<void> | null = null;
const PRACTICE_TTL_MS = 5 * 60 * 1000;

function toRatings(userPractices: UserQuestionPracticeRow[]): {
  userRatings: Record<string, 'easy' | 'medium' | 'hard'>;
  userPracticeDates: string[];
} {
  const userRatings: Record<string, 'easy' | 'medium' | 'hard'> = {};
  const dateSet = new Set<string>();
  userPractices.forEach((row) => {
    userRatings[row.question_id] = row.difficulty;
    if (row.updated_at) {
      const dateStr = new Date(row.updated_at).toLocaleDateString('en-CA');
      dateSet.add(dateStr);
    }
  });
  return { userRatings, userPracticeDates: Array.from(dateSet) };
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sections: [],
  questions: [],
  passages: [],
  userRatings: {},
  userPracticeDates: [],
  isLoaded: false,
  isLoading: false,
  lastFetchedAt: null,
  error: null,

  fetchPracticeData: async (options) => {
    const { isLoaded, lastFetchedAt } = get();
    const now = Date.now();

    if (isLoaded && !options?.force && lastFetchedAt && now - lastFetchedAt < PRACTICE_TTL_MS) {
      return;
    }

    // Dedupe: a fetch is already in flight — piggyback on it instead of
    // firing a second full `/api/practice` request.
    if (inFlightFetch) {
      return inFlightFetch;
    }

    set({ isLoading: true, error: null });

    inFlightFetch = (async () => {
      try {
        const res = await fetch('/api/practice');
        if (!res.ok) throw new Error('Failed to fetch practice data');
        const data = await res.json();

        const sections = (data.sections || []) as PracticeSection[];
        const questions = (data.questions || []) as PracticeQuestionItem[];
        const passages = (data.passages || []) as PracticePassage[];
        const userPractices = (data.userPractices || []) as UserQuestionPracticeRow[];
        const { userRatings, userPracticeDates } = toRatings(userPractices);

        set({
          sections,
          questions,
          passages,
          userRatings,
          userPracticeDates,
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
      } finally {
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  },

  refreshRatings: async () => {
    // Ratings are updated optimistically by `updateRating`; this background
    // refresh only reconciles server truth without replacing sections or
    // questions (so in-session lists never flicker or revert). It uses the
    // lightweight ratings endpoint and never touches the full-fetch TTL.
    // Coalesced with any in-flight full fetch or refresh so overlapping
    // ratings can't reconcile out of order.
    if (inFlightFetch) {
      await inFlightFetch;
      return;
    }
    if (inFlightRefresh) {
      return inFlightRefresh;
    }

    inFlightRefresh = (async () => {
      try {
        const res = await fetch('/api/practice/ratings');
        if (!res.ok) throw new Error('Failed to refresh practice ratings');
        const data = await res.json();
        const userPractices = (data.userPractices || []) as UserQuestionPracticeRow[];
        const { userRatings, userPracticeDates } = toRatings(userPractices);
        set({ userRatings, userPracticeDates });
      } catch (err) {
        console.error('Failed to refresh practice ratings:', err);
      } finally {
        inFlightRefresh = null;
      }
    })();

    return inFlightRefresh;
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
