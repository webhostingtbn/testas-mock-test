import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useExamStore } from '../../store/exam-store';

describe('useExamStore timer synchronization', () => {
  beforeEach(() => {
    useExamStore.getState().resetExam();
    useExamStore.getState().startExam({
      examId: 'test-exam-1',
      userExamId: 'attempt-1',
      sections: [
        {
          id: 'sec-1',
          title: 'Figure Sequence',
          questionType: 'figure_sequence',
          durationSeconds: 1500,
          questionCount: 20,
          questionIds: ['q1', 'q2'],
        },
        {
          id: 'sec-2',
          title: 'Completing Patterns',
          questionType: 'completing_patterns',
          durationSeconds: 1200,
          questionCount: 20,
          questionIds: ['q3', 'q4'],
        },
      ],
      flowSteps: [
        { type: 'section', sectionIndex: 0 },
        { type: 'break', breakDuration: 300 },
        { type: 'section', sectionIndex: 1 },
      ],
    });
  });

  it('initializes sectionStartTime to null when entering a new section', () => {
    useExamStore.getState().startSection(0);
    const state = useExamStore.getState();

    assert.strictEqual(state.currentSectionIndex, 0);
    assert.strictEqual(state.sectionStartTime, null);
    assert.strictEqual(state.sectionDuration, 1500);

    // Timer returns full duration when sectionStartTime is null (paused while loading)
    assert.strictEqual(useExamStore.getState().getRemainingTime(), 1500);
  });

  it('starts the timer only when startSectionTimer is explicitly called', () => {
    useExamStore.getState().startSection(0);
    assert.strictEqual(useExamStore.getState().sectionStartTime, null);

    const before = Date.now();
    useExamStore.getState().startSectionTimer();
    const after = Date.now();

    const startTime = useExamStore.getState().sectionStartTime;
    assert.notStrictEqual(startTime, null);
    assert.ok(typeof startTime === 'number' && startTime >= before && startTime <= after);

    // Calling startSectionTimer again does NOT reset the timer
    const firstStartTime = startTime;
    useExamStore.getState().startSectionTimer();
    assert.strictEqual(useExamStore.getState().sectionStartTime, firstStartTime);
  });

  it('preserves running sectionStartTime if startSection is called again for the same section (e.g. page refresh)', () => {
    useExamStore.getState().startSection(0);
    const testStartTime = Date.now() - 60000; // 1 minute elapsed
    useExamStore.setState({ sectionStartTime: testStartTime });

    // Re-trigger startSection for the same section (simulating page reload hydration)
    useExamStore.getState().startSection(0);

    assert.strictEqual(useExamStore.getState().sectionStartTime, testStartTime);
    const remaining = useExamStore.getState().getRemainingTime();
    assert.ok(remaining <= 1441 && remaining >= 1438); // approximately 1500 - 60
  });

  it('resets sectionStartTime to null when moving to a different section', () => {
    useExamStore.getState().startSection(0);
    useExamStore.getState().startSectionTimer();
    assert.notStrictEqual(useExamStore.getState().sectionStartTime, null);

    // Switch to section 1
    useExamStore.getState().startSection(1);
    assert.strictEqual(useExamStore.getState().currentSectionIndex, 1);
    assert.strictEqual(useExamStore.getState().sectionStartTime, null);
    assert.strictEqual(useExamStore.getState().sectionDuration, 1200);
    assert.strictEqual(useExamStore.getState().getRemainingTime(), 1200);
  });
});
