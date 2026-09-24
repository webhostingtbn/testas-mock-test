import { isFullCompletion } from '@/lib/types';
import type { ModuleTestType } from '@/lib/types';
import {
  PAPER_CORE_SUBTESTS,
  DIGITAL_CORE_SUBTESTS,
  PAPER_MODULE_SUBTESTS,
  getModuleCategory,
  type SubtestDefinition,
} from '@/lib/constants';

export interface RadarStat {
  key: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface RadarAttemptInput {
  status?: string;
  completion_reason?: string | null;
  exam_format?: string | null;
  exams?: { format?: string | null } | null;
  section_scores?: Array<{
    key: string;
    label: string;
    correct: number;
    total: number;
  }>;
}

export function getCanonicalSubtests(
  format: 'Digital' | 'Paper',
  activeModule?: ModuleTestType | null
): SubtestDefinition[] {
  const isPaper = format === 'Paper';
  const core = isPaper ? PAPER_CORE_SUBTESTS : DIGITAL_CORE_SUBTESTS;
  let moduleDefs: SubtestDefinition[] = [];

  if (isPaper) {
    const cat = getModuleCategory(activeModule ?? null);
    if (cat && PAPER_MODULE_SUBTESTS[cat]) {
      moduleDefs = PAPER_MODULE_SUBTESTS[cat];
    }
  } else if (activeModule) {
    const moduleLabel =
      activeModule.includes('science') || activeModule === 'CS'
        ? 'Natural & Computer Science'
        : activeModule;
    moduleDefs = [
      {
        id: 'module_mcq',
        title: `${moduleLabel} Module`,
        description: `Subject module for ${moduleLabel}`,
        iconName: 'Laptop',
      },
    ];
  }

  return [...core, ...moduleDefs];
}

export function matchSubtestToCanonical(
  key: string,
  label: string,
  canonicalSubtests: SubtestDefinition[]
): string | null {
  const normKey = key.toLowerCase();
  const normLabel = label.toLowerCase();

  // 1. Direct key match
  const directMatch = canonicalSubtests.find((s) => s.id === key);
  if (directMatch) return directMatch.id;

  // 2. Keyword matching across canonical definitions
  for (const subtest of canonicalSubtests) {
    const subtestId = subtest.id.toLowerCase();
    const subtestTitle = subtest.title.toLowerCase();

    // Direct string match
    if (normKey === subtestId || normLabel === subtestTitle) return subtest.id;

    // Specific TestAS subtests keyword matching
    if (subtestId === 'figure_sequence') {
      if (normLabel.includes('figure') || normLabel.includes('pattern') || normKey.includes('figure') || normKey.includes('pattern')) {
        return subtest.id;
      }
    } else if (subtestId === 'math_equation') {
      if (normLabel.includes('equation') || normLabel.includes('math') || normKey.includes('equation') || normKey.includes('math')) {
        return subtest.id;
      }
    } else if (subtestId === 'latin_square') {
      if (normLabel.includes('latin') || normLabel.includes('square') || normKey.includes('latin') || normKey.includes('square')) {
        return subtest.id;
      }
    } else if (subtestId === 'solving_quantitative') {
      if (normLabel.includes('quantitative') || normLabel.includes('solving') || normKey.includes('quantitative')) {
        return subtest.id;
      }
    } else if (subtestId === 'inferring_relationships') {
      if (
        (normLabel.includes('inferring') || normLabel.includes('relationship')) &&
        !normLabel.includes('scientific') &&
        !normLabel.includes('technical') &&
        !normLabel.includes('economic')
      ) {
        return subtest.id;
      }
    } else if (subtestId === 'numerical_series') {
      if (normLabel.includes('numerical') || normLabel.includes('series') || normKey.includes('numerical') || normKey.includes('series')) {
        return subtest.id;
      }
    } else if (subtestId === 'module_mcq') {
      if (normLabel.includes('module') || normLabel.includes('science') || normLabel.includes('computer') || normLabel.includes('engineer') || normLabel.includes('econ')) {
        return subtest.id;
      }
    } else {
      if (normKey.includes(subtestId) || normLabel.includes(subtestTitle)) {
        return subtest.id;
      }
    }
  }

  return null;
}

/**
 * Computes peak proficiency per canonical subtest for the user's format & active module.
 * Eliminates duplicate vertices caused by per-exam UUIDs and filters out foreign modules.
 */
export function calculatePeakRadarStats(
  pastExams: RadarAttemptInput[],
  formatOverride?: 'Digital' | 'Paper',
  activeModule?: ModuleTestType | null
): RadarStat[] {
  const format = formatOverride || 'Digital';
  const canonical = getCanonicalSubtests(format, activeModule);

  const subtestMap = new Map<string, { label: string; bestPct: number; correct: number; total: number }>();
  let hasCompletedAttempts = false;

  for (const attempt of pastExams) {
    if (attempt.status !== 'completed') continue;
    if (!isFullCompletion(attempt)) continue;
    const attemptFormat = attempt.exam_format ?? attempt.exams?.format ?? 'Digital';
    if (formatOverride && attemptFormat !== formatOverride) continue;

    hasCompletedAttempts = true;

    for (const section of attempt.section_scores ?? []) {
      if (!section.total || section.total <= 0) continue;
      const matchedKey = matchSubtestToCanonical(section.key, section.label, canonical);
      if (!matchedKey) continue;

      const canonicalDef = canonical.find((s) => s.id === matchedKey);
      const label = canonicalDef ? canonicalDef.title : section.label;
      const pct = Math.round((section.correct / section.total) * 100);
      const existing = subtestMap.get(matchedKey);

      if (!existing || pct > existing.bestPct) {
        subtestMap.set(matchedKey, {
          label,
          bestPct: pct,
          correct: section.correct,
          total: section.total,
        });
      }
    }
  }

  if (!hasCompletedAttempts) {
    return [];
  }

  return canonical.map((def) => {
    const data = subtestMap.get(def.id);
    return {
      key: def.id,
      label: def.title,
      correct: data?.correct ?? 0,
      total: data?.total ?? 0,
      percentage: data?.bestPct ?? 0,
    };
  });
}
