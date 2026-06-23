/**
 * Exam Orchestrator
 *
 * Centralizes the exam flow logic (start, resume, finish) and coordinates
 * between the store, database, and constants for section filtering.
 *
 * This module serves as the single seam for exam orchestration, hiding
 * implementation details (DB calls, storage, section filtering) behind
 * clear domain concepts.
 */

import { createClient } from '@/lib/supabase/client';
import { useExamStore, type StoredSection, type ExamFlowStep } from '@/lib/store/exam-store';
import {
  BREAK_DURATIONS,
  BREAK_DURATION_TIME_OF_TEST,
  CORE_QUESTION_TYPES,
  MODULE_TEST_LABELS,
  PAPER_MODULE_QUESTION_TYPES,
  getModuleCategory,
  filterSections,
} from '@/lib/constants';
import type {
  Exam,
  ModuleTestType,
  Section,
  UserExam,
} from '@/lib/types';

// =============================================================
// Section Building Helpers
// =============================================================

/**
 * Determines if a question type is a module section based on format.
 */
function isModuleQuestionType(questionType: string, isPaper: boolean): boolean {
  if (isPaper) {
    const paperModuleTypes = [
      'sc_1', 'sc_2',
      'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3',
      'econ_1', 'econ_2',
    ];
    return paperModuleTypes.includes(questionType);
  } else {
    const digitalModuleTypes = [
      'module_mcq',
      'interpreting_texts',
      'representation_systems',
      'linguistic_structures',
    ];
    return digitalModuleTypes.includes(questionType);
  }
}

/**
 * Fetches passages for a module section that uses passage-based questions.
 */
async function fetchPassagesForSection(supabase: any, sectionId: string): Promise<string[]> {
  const { data: passages, error } = await supabase
    .from('passages')
    .select('id')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: true });

  if (error || !passages) return [];
  return passages.map((p: any) => p.id);
}

/**
 * Fetches questions for a section and groups them by section_id.
 */
async function fetchQuestionsForSection(
  supabase: any,
  sectionId: string
): Promise<Record<string, string[]>> {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, section_id, sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: true });

  if (error || !questions) return {};

  const grouped: Record<string, string[]> = {};
  for (const q of questions) {
    if (!grouped[q.section_id]) {
      grouped[q.section_id] = [];
    }
    grouped[q.section_id].push(q.id);
  }
  return grouped;
}

/**
 * Builds a section object from database section data.
 */
async function buildSectionObject(
  supabase: any,
  section: Section,
  questionIdsBySectionId: Record<string, string[]>,
  activeModule: ModuleTestType | null,
  isPaper: boolean
): Promise<StoredSection> {
  // For Digital module sections that use passages, fetch passage IDs instead
  const passageSectionTypes = [
    'module_mcq',
    'interpreting_texts',
    'representation_systems',
    'linguistic_structures',
  ];

  if (isModuleQuestionType(section.question_type, isPaper)) {
    if (isPaper || !passageSectionTypes.includes(section.question_type)) {
      // Paper module or Digital module with standard questions
      return {
        id: section.id,
        title: section.title,
        questionType: section.question_type,
        durationSeconds: section.duration_seconds,
        questionCount: section.question_count,
        questionIds: questionIdsBySectionId[section.id] || [],
      };
    } else {
      // Digital module with passages (e.g., module_mcq, interpreting_texts)
      const passageIds = await fetchPassagesForSection(supabase, section.id);
      return {
        id: section.id,
        title: section.title,
        questionType: section.question_type,
        durationSeconds: section.duration_seconds,
        questionCount: section.question_count,
        questionIds: passageIds,
      };
    }
  }

  // Core section - use standard question IDs
  return {
    id: section.id,
    title: section.title,
    questionType: section.question_type,
    durationSeconds: section.duration_seconds,
    questionCount: section.question_count,
    questionIds: questionIdsBySectionId[section.id] || [],
  };
}

// =============================================================
// Flow Building Helpers
// =============================================================

/**
 * Determines break duration between two sections based on whether they're
 * in the same module (core vs module test).
 */
function calculateBreakDuration(
  currentSection: StoredSection,
  nextSection: StoredSection,
  isPaper: boolean
): number {
  const currentIsModule = isModuleQuestionType(currentSection.questionType, isPaper);
  const nextIsModule = isModuleQuestionType(nextSection.questionType, isPaper);

  // Long break only when transitioning from core to module
  if (!currentIsModule && nextIsModule) {
    return BREAK_DURATIONS.LONG;
  }
  return BREAK_DURATIONS.SHORT;
}

/**
 * Builds the exam flow (sections and breaks) from filtered sections.
 */
function buildExamFlow(sections: StoredSection[], isPaper: boolean): ExamFlowStep[] {
  const flowSteps: ExamFlowStep[] = [];

  for (let i = 0; i < sections.length; i++) {
    flowSteps.push({ type: 'section' as const, sectionIndex: i });

    if (i < sections.length - 1) {
      const breakDuration = calculateBreakDuration(
        sections[i],
        sections[i + 1],
        isPaper
      );
      flowSteps.push({ type: 'break' as const, breakDuration });
    }
  }

  return flowSteps;
}

// =============================================================
// Exam Orchestration API
// =============================================================

/**
 * Fetches and filters sections for an exam based on format and active module.
 * Returns the filtered sections ready for exam construction.
 */
async function fetchAndFilterSections(
  examId: string,
  activeModule: ModuleTestType | null,
  format: 'Digital' | 'Paper'
): Promise<Section[]> {
  const supabase = createClient();

  const { data: sections, error } = await supabase
    .from('sections')
    .select('id, title, question_type, duration_seconds, question_count, sort_order')
    .eq('exam_id', examId)
    .order('sort_order', { ascending: true });

  if (error || !sections) {
    throw new Error(`Failed to load sections for exam ${examId}: ${error?.message}`);
  }

  const isPaper = format === 'Paper';
  const { coreSections, moduleSections } = filterSections(sections, isPaper, activeModule);

  return [...coreSections, ...moduleSections];
}

/**
 * Starts a new exam session:
 * 1. Fetches and filters sections based on format and module
 * 2. Fetches all questions and groups them by section
 * 3. Builds section objects (handling module passages)
 * 4. Builds the exam flow (sections + breaks)
 * 5. Creates a user_exam record in the database
 * 6. Initializes the store with the exam data
 */
export async function startExam(
  examId: string,
  activeModule: ModuleTestType | null,
  format: 'Digital' | 'Paper',
  profileId: string
): Promise<void> {
  const supabase = createClient();
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    // 1. Fetch and filter sections
    const filteredSections = await fetchAndFilterSections(examId, activeModule, format);

    // 2. Fetch all questions and group by section
    const allSectionIds = filteredSections.map((s) => s.id);
    const questionIdsBySectionId: Record<string, string[]> = {};

    if (allSectionIds.length > 0) {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, section_id, sort_order')
        .in('section_id', allSectionIds)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to load questions: ${error.message}`);
      }

      // Group questions by section_id
      for (const q of questions) {
        if (!questionIdsBySectionId[q.section_id]) {
          questionIdsBySectionId[q.section_id] = [];
        }
        questionIdsBySectionId[q.section_id].push(q.id);
      }
    }

    // 3. Build section objects
    const isPaper = format === 'Paper';
    const builtSections: StoredSection[] = [];
    for (const section of filteredSections) {
      const sectionObj = await buildSectionObject(
        supabase,
        section,
        questionIdsBySectionId,
        activeModule,
        isPaper
      );
      builtSections.push(sectionObj);
    }

    // 4. Build the exam flow
    const flowSteps = buildExamFlow(builtSections, isPaper);

    // 5. Create the user_exam record
    const { data: userExam, error: userExamError } = await supabase
      .from('user_exams')
      .insert({
        user_id: profileId,
        exam_id: examId,
        status: 'in_progress',
      })
      .select()
      .single();

    if (userExamError || !userExam) {
      throw new Error(`Failed to create exam session: ${userExamError?.message}`);
    }

    // 6. Initialize the store
    storeStartExam({
      examId,
      userExamId: userExam.id,
      sections: builtSections,
      flowSteps,
    });
  } catch (err) {
    console.error('[ExamOrchestrator] Error starting exam:', err);
    throw err;
  }
}

/**
 * Resumes an existing exam session:
 * 1. Fetches the user_exam to get the exam_id
 * 2. Fetches and filters sections based on format and module
 * 3. Rebuilds section objects and flow
 * 4. Updates user_id if profile is available
 * 5. Re-initializes the store with the saved exam data
 */
export async function resumeExam(
  userExamId: string,
  activeModule: ModuleTestType | null,
  profileId?: string | null
): Promise<void> {
  const supabase = createClient();
  const { startExam: storeStartExam } = useExamStore.getState();

  try {
    // 1. Fetch user_exam to get exam_id and format
    const { data: userExam, error: userExamError } = await supabase
      .from('user_exams')
      .select('exam_id, status')
      .eq('id', userExamId)
      .single();

    if (userExamError || !userExam) {
      throw new Error(`Failed to load exam session: ${userExamError?.message}`);
    }

    // 2. Fetch exam to get format
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('format')
      .eq('id', userExam.exam_id)
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to fetch exam format: ${examError?.message}`);
    }

    const format = exam.format as 'Digital' | 'Paper';
    const filteredSections = await fetchAndFilterSections(
      userExam.exam_id,
      activeModule,
      format
    );

    // 3. Fetch all questions and group by section
    const allSectionIds = filteredSections.map((s) => s.id);
    const questionIdsBySectionId: Record<string, string[]> = {};

    if (allSectionIds.length > 0) {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, section_id, sort_order')
        .in('section_id', allSectionIds)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to load questions: ${error.message}`);
      }

      for (const q of questions) {
        if (!questionIdsBySectionId[q.section_id]) {
          questionIdsBySectionId[q.section_id] = [];
        }
        questionIdsBySectionId[q.section_id].push(q.id);
      }
    }

    // 4. Update user_id if profile is available
    if (profileId) {
      const { error: updateError } = await supabase
        .from('user_exams')
        .update({ user_id: profileId })
        .eq('id', userExamId)
        .maybeSingle();

      if (updateError) {
        console.warn('[ExamOrchestrator] Could not update user_id in user_exam:', updateError);
      }
    }

    // 5. Build section objects
    const isPaper = format === 'Paper';
    const builtSections: StoredSection[] = [];
    for (const section of filteredSections) {
      const sectionObj = await buildSectionObject(
        supabase,
        section,
        questionIdsBySectionId,
        activeModule,
        isPaper
      );
      builtSections.push(sectionObj);
    }

    // 6. Build the exam flow
    const flowSteps = buildExamFlow(builtSections, isPaper);

    // 7. Re-initialize the store
    storeStartExam({
      examId: userExam.exam_id,
      userExamId,
      sections: builtSections,
      flowSteps,
    });
  } catch (err) {
    console.error('[ExamOrchestrator] Error resuming exam:', err);
    throw err;
  }
}

/**
 * Finishes an exam session:
 * 1. Updates the user_exam status to 'completed'
 * 2. Calculates and saves total score
 * 3. Resets the exam store
 */
export async function finishExam(
  userExamId: string,
  totalScore: number,
  maxScore: number
): Promise<void> {
  const supabase = createClient();
  const { resetExam } = useExamStore.getState();

  try {
    const { error } = await supabase
      .from('user_exams')
      .update({
        status: 'completed',
        total_score: totalScore,
        max_score: maxScore,
        completed_at: new Date().toISOString(),
      })
      .eq('id', userExamId);

    if (error) {
      throw new Error(`Failed to finish exam session: ${error.message}`);
    }

    // Reset the store
    resetExam();
  } catch (err) {
    console.error('[ExamOrchestrator] Error finishing exam:', err);
    throw err;
  }
}

// =============================================================
// Hook Wrapper for React Components
// =============================================================

/**
 * React hook that provides exam orchestration actions wrapped in a React-friendly API.
 * Handles the 'profile not loaded yet' case gracefully by deferring exam start.
 */
export function useExamOrchestrator() {
  /**
   * Starts an exam, waiting for profile to be loaded if needed.
   * Returns a promise that resolves when the exam is started or rejects on error.
   */
  async function handleStartExam(
    examId: string,
    activeModule: ModuleTestType | null,
    format: 'Digital' | 'Paper',
    profileId?: string | null
  ): Promise<void> {
    if (!profileId) {
      throw new Error('Profile ID is required to start an exam');
    }

    try {
      await startExam(examId, activeModule, format, profileId);
    } catch (err) {
      throw new Error(`Failed to start exam: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Resumes an exam, waiting for profile to be loaded if needed.
   */
  async function handleResumeExam(
    userExamId: string,
    activeModule: ModuleTestType | null,
    profileId?: string | null
  ): Promise<void> {
    try {
      await resumeExam(userExamId, activeModule, profileId);
    } catch (err) {
      throw new Error(`Failed to resume exam: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Handles the finish exam flow with proper state cleanup.
   */
  async function handleFinishExam(
    userExamId: string,
    totalScore: number,
    maxScore: number
  ): Promise<void> {
    try {
      await finishExam(userExamId, totalScore, maxScore);
    } catch (err) {
      console.error('[ExamOrchestrator] Error in handleFinishExam:', err);
      throw err;
    }
  }

  return {
    startExam: handleStartExam,
    resumeExam: handleResumeExam,
    finishExam: handleFinishExam,
  };
}
