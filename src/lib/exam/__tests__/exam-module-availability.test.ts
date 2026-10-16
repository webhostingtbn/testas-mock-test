import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterSections } from '../../constants';
import type { Lang } from '../../i18n/config';
import type { ExamSectionSummary } from '../../types';

interface MockSection extends ExamSectionSummary {
  id: string;
  title: string;
  question_type: string;
  duration_seconds: number;
  question_count: number;
  sort_order: number;
  languages?: Lang[];
}

function computeExamAvailability(
  sections: MockSection[],
  gapsMap: Map<string, number>,
  isPaper: boolean,
  activeModule: string | null,
): { isGermanAvailable: boolean; sectionsWithLanguages: MockSection[] } {
  const sectionsWithLanguages: MockSection[] = sections
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => ({
      ...s,
      languages: (gapsMap.get(s.id) === 0 ? ['en', 'de'] : ['en']) as Lang[],
    }));

  let applicableSections = sectionsWithLanguages;
  if (activeModule) {
    const { coreSections, moduleSections } = filterSections(
      sectionsWithLanguages,
      isPaper,
      activeModule,
    );
    const scoped = [...coreSections, ...moduleSections];
    if (scoped.length > 0) {
      applicableSections = scoped;
    }
  }

  const isGermanAvailable =
    applicableSections.length > 0 &&
    applicableSections.every((s) => gapsMap.get(s.id) === 0);

  return { isGermanAvailable, sectionsWithLanguages };
}

describe('Module-Scoped Exam German Availability', () => {
  // Simulates Paper Test Suit 2: Core + Engineering + Economics + sc_2
  const suit2Sections: MockSection[] = [
    { id: 'sec-core-1', title: 'Solving Quantitative Problems', question_type: 'solving_quantitative', duration_seconds: 2700, question_count: 22, sort_order: 1 },
    { id: 'sec-core-2', title: 'Inferring Relationships', question_type: 'inferring_relationships', duration_seconds: 2700, question_count: 22, sort_order: 2 },
    { id: 'sec-core-3', title: 'Continuing Numerical Series', question_type: 'numerical_series', duration_seconds: 2700, question_count: 22, sort_order: 3 },
    { id: 'sec-core-4', title: 'Completing Patterns', question_type: 'completing_patterns', duration_seconds: 2700, question_count: 22, sort_order: 4 },
    { id: 'sec-eng-1', title: 'Technical Problem Solving', question_type: 'eng_1', duration_seconds: 3600, question_count: 22, sort_order: 5 },
    { id: 'sec-eng-2', title: 'Technical 2D Views', question_type: 'eng_2_2d', duration_seconds: 3600, question_count: 22, sort_order: 6 },
    { id: 'sec-eng-3', title: 'Technical 3D Views', question_type: 'eng_2_3d', duration_seconds: 3600, question_count: 22, sort_order: 7 },
    { id: 'sec-eng-4', title: 'Technical Understanding', question_type: 'eng_3', duration_seconds: 3600, question_count: 22, sort_order: 8 },
    { id: 'sec-econ-1', title: 'Analyzing Economic Relations', question_type: 'econ_1', duration_seconds: 3600, question_count: 22, sort_order: 9 },
    { id: 'sec-sc-1', title: 'Analyzing Scientific Interrelationships', question_type: 'sc_1', duration_seconds: 3600, question_count: 22, sort_order: 10 },
    { id: 'sec-sc-2', title: 'Understanding Formal Depictions', question_type: 'sc_2', duration_seconds: 3600, question_count: 22, sort_order: 11 },
  ];

  // In Suit 2, sc_2 has 42 missing German entries, while everything else has 0
  const suit2Gaps = new Map<string, number>([
    ['sec-core-1', 0],
    ['sec-core-2', 0],
    ['sec-core-3', 0],
    ['sec-core-4', 0],
    ['sec-eng-1', 0],
    ['sec-eng-2', 0],
    ['sec-eng-3', 0],
    ['sec-eng-4', 0],
    ['sec-econ-1', 0],
    ['sec-sc-1', 0],
    ['sec-sc-2', 42], // only sc_2 has missing translations
  ]);

  it('unlocks German for Engineering students on Paper Test Suit 2', () => {
    const result = computeExamAvailability(suit2Sections, suit2Gaps, true, 'Engineering');
    assert.strictEqual(result.isGermanAvailable, true);

    // Verify sc_2 individually still marks German as unavailable
    const sc2Sec = result.sectionsWithLanguages.find((s) => s.id === 'sec-sc-2');
    assert.deepStrictEqual(sc2Sec?.languages, ['en']);

    // Verify eng sections individually mark German as available
    const engSec = result.sectionsWithLanguages.find((s) => s.id === 'sec-eng-1');
    assert.deepStrictEqual(engSec?.languages, ['en', 'de']);
  });

  it('keeps German locked for Economics students on Paper Test Suit 2 (Economics includes sc_2)', () => {
    // Economics module in Paper includes ['econ_1', 'sc_2']. Since sc_2 has gaps in Suit 2, it remains locked.
    const result = computeExamAvailability(suit2Sections, suit2Gaps, true, 'Economics');
    assert.strictEqual(result.isGermanAvailable, false);
  });

  it('keeps German locked for Natural Science students on Paper Test Suit 2 due to sc_2 gap', () => {
    const result = computeExamAvailability(suit2Sections, suit2Gaps, true, 'natural_computer_science');
    assert.strictEqual(result.isGermanAvailable, false);
  });

  it('keeps German locked when student has no active module chosen', () => {
    const result = computeExamAvailability(suit2Sections, suit2Gaps, true, null);
    assert.strictEqual(result.isGermanAvailable, false);
  });

  it('unlocks German for all students when all sections have 0 gaps (e.g. Suit 1 or Suit 7)', () => {
    const cleanGaps = new Map<string, number>(suit2Gaps);
    cleanGaps.set('sec-sc-2', 0); // translated

    const engResult = computeExamAvailability(suit2Sections, cleanGaps, true, 'Engineering');
    assert.strictEqual(engResult.isGermanAvailable, true);

    const scResult = computeExamAvailability(suit2Sections, cleanGaps, true, 'natural_computer_science');
    assert.strictEqual(scResult.isGermanAvailable, true);

    const noModuleResult = computeExamAvailability(suit2Sections, cleanGaps, true, null);
    assert.strictEqual(noModuleResult.isGermanAvailable, true);
  });
});
