'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---- Types for the store ----

export interface StoredSection {
  id: string;
  title: string;
  questionType: string;
  durationSeconds: number;
  questionCount: number;
  questionIds: string[];
}

export interface ExamFlowStep {
  type: 'section' | 'break';
  sectionIndex?: number;
  breakDuration?: number;
}

interface ExamState {
  // ---- Exam metadata ----
  currentExamId: string | null;
  userExamId: string | null;
  sections: StoredSection[];
  flowSteps: ExamFlowStep[];
  currentFlowStepIndex: number;

  // ---- Current section state ----
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: Record<string, Record<string, unknown>>;
  // answers[sectionId][questionId] = answer value

  // ---- Timer ----
  sectionStartTime: number | null; // Unix timestamp (ms)
  sectionDuration: number; // seconds
  breakStartTime: number | null;
  breakDuration: number;

  // ---- Font size ----
  fontSize: number;

  // ---- Actions ----
  startExam: (params: {
    examId: string;
    userExamId: string;
    sections: StoredSection[];
    flowSteps: ExamFlowStep[];
  }) => void;

  startSection: (sectionIndex: number) => void;
  startBreak: (duration: number) => void;

  setAnswer: (sectionId: string, questionId: string, answer: unknown) => void;
  getAnswer: (sectionId: string, questionId: string) => unknown;

  nextQuestion: () => void;
  prevQuestion: () => void;
  goToQuestion: (index: number) => void;

  advanceFlowStep: () => void;
  getCurrentFlowStep: () => ExamFlowStep | null;

  getRemainingTime: () => number;
  getBreakRemainingTime: () => number;

  setFontSize: (size: number) => void;

  getAnsweredCount: (sectionId: string) => number;
  isQuestionAnswered: (sectionId: string, questionIndex: number) => boolean;

  resetExam: () => void;
}

const initialState = {
  currentExamId: null,
  userExamId: null,
  sections: [],
  flowSteps: [],
  currentFlowStepIndex: 0,
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  answers: {},
  sectionStartTime: null,
  sectionDuration: 0,
  breakStartTime: null,
  breakDuration: 0,
  fontSize: 16,
};

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ---- Start exam ----
      startExam: ({ examId, userExamId, sections, flowSteps }) => {
        set({
          currentExamId: examId,
          userExamId,
          sections,
          flowSteps,
          currentFlowStepIndex: 0,
          currentSectionIndex: 0,
          currentQuestionIndex: 0,
          answers: {},
          sectionStartTime: null,
          breakStartTime: null,
        });
      },

      // ---- Start a section (sets timer) ----
      startSection: (sectionIndex: number) => {
        const { sections } = get();
        const section = sections[sectionIndex];
        if (!section) return;

        set({
          currentSectionIndex: sectionIndex,
          currentQuestionIndex: 0,
          sectionStartTime: Date.now(),
          sectionDuration: section.durationSeconds,
        });
      },

      // ---- Start a break ----
      startBreak: (duration: number) => {
        set({
          breakStartTime: Date.now(),
          breakDuration: duration,
        });
      },

      // ---- Set answer for a question ----
      setAnswer: (sectionId, questionId, answer) => {
        set((state) => ({
          answers: {
            ...state.answers,
            [sectionId]: {
              ...state.answers[sectionId],
              [questionId]: answer,
            },
          },
        }));
      },

      // ---- Get answer for a question ----
      getAnswer: (sectionId, questionId) => {
        const { answers } = get();
        return answers[sectionId]?.[questionId] ?? null;
      },

      // ---- Navigation ----
      nextQuestion: () => {
        const { currentQuestionIndex, currentSectionIndex, sections } = get();
        const section = sections[currentSectionIndex];
        if (!section) return;
        if (currentQuestionIndex < section.questionCount - 1) {
          set({ currentQuestionIndex: currentQuestionIndex + 1 });
        }
      },

      prevQuestion: () => {
        const { currentQuestionIndex } = get();
        if (currentQuestionIndex > 0) {
          set({ currentQuestionIndex: currentQuestionIndex - 1 });
        }
      },

      goToQuestion: (index: number) => {
        const { currentSectionIndex, sections } = get();
        const section = sections[currentSectionIndex];
        if (!section) return;
        if (index >= 0 && index < section.questionCount) {
          set({ currentQuestionIndex: index });
        }
      },

      // ---- Flow step management ----
      advanceFlowStep: () => {
        set((state) => ({
          currentFlowStepIndex: state.currentFlowStepIndex + 1,
          sectionStartTime: null,
          breakStartTime: null,
        }));
      },

      getCurrentFlowStep: () => {
        const { flowSteps, currentFlowStepIndex } = get();
        return flowSteps[currentFlowStepIndex] ?? null;
      },

      // ---- Timer calculations ----
      getRemainingTime: () => {
        const { sectionStartTime, sectionDuration } = get();
        if (!sectionStartTime) return sectionDuration;
        const elapsed = (Date.now() - sectionStartTime) / 1000;
        return Math.max(0, sectionDuration - elapsed);
      },

      getBreakRemainingTime: () => {
        const { breakStartTime, breakDuration } = get();
        if (!breakStartTime) return breakDuration;
        const elapsed = (Date.now() - breakStartTime) / 1000;
        return Math.max(0, breakDuration - elapsed);
      },

      // ---- Font size ----
      setFontSize: (size: number) => {
        set({ fontSize: size });
      },

      // ---- Answer tracking ----
      getAnsweredCount: (sectionId: string) => {
        const { answers } = get();
        const sectionAnswers = answers[sectionId];
        if (!sectionAnswers) return 0;
        return Object.values(sectionAnswers).filter((a) => a !== null && a !== undefined).length;
      },

      isQuestionAnswered: (sectionId: string, questionIndex: number) => {
        const { answers, sections, currentSectionIndex } = get();
        const section = sections[currentSectionIndex];
        if (!section) return false;
        const questionId = section.questionIds[questionIndex];
        if (!questionId) return false;
        const answer = answers[sectionId]?.[questionId];
        return answer !== null && answer !== undefined;
      },

      // ---- Reset ----
      resetExam: () => {
        set(initialState);
      },
    }),
    {
      name: 'testas-exam-store',
      // Only persist essential data for disconnect resilience
      partialize: (state) => ({
        currentExamId: state.currentExamId,
        userExamId: state.userExamId,
        sections: state.sections,
        flowSteps: state.flowSteps,
        currentFlowStepIndex: state.currentFlowStepIndex,
        currentSectionIndex: state.currentSectionIndex,
        currentQuestionIndex: state.currentQuestionIndex,
        answers: state.answers,
        sectionStartTime: state.sectionStartTime,
        sectionDuration: state.sectionDuration,
        breakStartTime: state.breakStartTime,
        breakDuration: state.breakDuration,
        fontSize: state.fontSize,
      }),
    }
  )
);
