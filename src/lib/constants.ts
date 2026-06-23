// =============================================================
// Constants for the TestAS Mock Test application
// =============================================================

/** Section durations in seconds */
export const SECTION_DURATIONS = {
  FIGURE_SEQUENCE: 20 * 60,    // 20 minutes
  MATH_EQUATION: 25 * 60,      // 25 minutes
  LATIN_SQUARE: 20 * 60,       // 20 minutes
  MODULE_TEST: 150 * 60,       // 2.5 hours (150 minutes)
} as const;

/** Break durations in seconds */
export const BREAK_DURATIONS = {
  SHORT: 2 * 60,    // 2 minutes between core subtests
  LONG: 30 * 60,    // 30 minutes between core test and module test
} as const;

export const BREAK_DURATION_TIME_OF_TEST = {
  'digital': BREAK_DURATIONS.SHORT * 3 + BREAK_DURATIONS.LONG,
  'paper': BREAK_DURATIONS.SHORT * 4 + BREAK_DURATIONS.LONG,
}

/** Major display labels */
export const MAJOR_LABELS: Record<string, string> = {
  economics: 'Economics',
  engineering: 'Engineering',
  natural_computer_science: 'Natural & Computer Science',
} as const;

/** Module test display labels */
export const MODULE_TEST_LABELS: Record<string, string> = {
  economics: 'Economics',
  Economics: 'Economics',
  engineering: 'Engineering',
  Engineering: 'Engineering',
  natural_computer_science: 'Natural Science and Computer Science',
  math_computer_natural_science: 'Natural Science and Computer Science',
  CS: 'Natural Science and Computer Science',
} as const;

/** Module test options for the selection page */
export const MODULE_TEST_OPTIONS = [
  {
    value: 'economics' as const,
    label: 'Economics',
    icon: '📊',
    description: 'Analytical evaluation of charts, processes, and economic relationships',
  },
  {
    value: 'engineering' as const,
    label: 'Engineering',
    icon: '⚙️',
    description: 'Technical comprehension, spatial visualization, and applied physics',
  },
  {
    value: 'natural_computer_science' as const,
    label: 'Natural Science and Computer Science',
    icon: '🔬',
    description: 'Abstract reasoning, formal logic, and scientific data analysis',
  },
] as const;

/** Section display labels */
export const SECTION_TYPE_LABELS: Record<string, string> = {
  figure_sequence: 'Figure Sequences',
  math_equation: 'Mathematical Equations',
  latin_square: 'Latin Squares',
  module_mcq: 'Module Test',
  solving_quantitative: 'Solving Quantitative Problems',
  inferring_relationships: 'Inferring Relationships',
  numerical_series: 'Continuing Numerical Series',
  interpreting_texts: 'Understanding and Interpreting Texts',
  representation_systems: 'Using Representation Systems Flexibly',
  linguistic_structures: 'Recognizing Linguistic Structures',
} as const;

/** Font size options */
export const FONT_SIZES = {
  SMALL: 14,
  MEDIUM: 16,
  LARGE: 20,
} as const;

/** Colors matching the TestAS orange theme */
export const THEME_COLORS = {
  ORANGE_PRIMARY: '#F57C00',
  ORANGE_LIGHT: '#FFB74D',
  ORANGE_DARK: '#E65100',
  BLUE_BUTTON: '#1976D2',
  BLUE_HOVER: '#1565C0',
  GRAY_ANSWERED: '#9E9E9E',
  GRAY_BORDER: '#BDBDBD',
  WHITE: '#FFFFFF',
  BG_LIGHT: '#F5F5F5',
} as const;

/** Core question types by format */
export const CORE_QUESTION_TYPES: Record<'Paper' | 'Digital', string[]> = {
  Paper: [
    'solving_quantitative',
    'inferring_relationships',
    'completing_patterns',
    'numerical_series'
  ],
  Digital: [
    'figure_sequence',
    'math_equation',
    'latin_square'
  ]
};

/** Paper module question types by category */
export const PAPER_MODULE_QUESTION_TYPES: Record<'science' | 'engineering' | 'economics', string[]> = {
  science: ['sc_1', 'sc_2'],
  engineering: ['eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3'],
  economics: ['econ_1', 'econ_2']
};

/** Normalizes the user's module name to a standard category */
export function getModuleCategory(activeModule: string | null): 'science' | 'engineering' | 'economics' | null {
  if (!activeModule) return null;
  const lower = activeModule.toLowerCase();
  if (lower.includes('science') || lower === 'cs') {
    return 'science';
  }
  if (lower.includes('engin')) {
    return 'engineering';
  }
  if (lower.includes('econ')) {
    return 'economics';
  }
  return null;
}

/** Centralized helper to filter core and module sections based on format and active module */
export function filterSections(
  sections: any[],
  isPaper: boolean,
  activeModule: string | null
): { coreSections: any[]; moduleSections: any[] } {
  // 1. Separate Core sections
  const coreTypes = CORE_QUESTION_TYPES[isPaper ? 'Paper' : 'Digital'];
  const coreSections = sections.filter((s: any) => coreTypes.includes(s.question_type));

  // 2. Separate Module sections
  const moduleSections = sections.filter((s: any) => {
    if (!activeModule) return false;

    if (isPaper) {
      const category = getModuleCategory(activeModule);
      if (!category) return false;
      const allowedTypes = PAPER_MODULE_QUESTION_TYPES[category];
      return allowedTypes.includes(s.question_type);
    } else {
      // For Digital, all module sections are grouped under the user's selected module title
      const targetModuleTitle = MODULE_TEST_LABELS[activeModule];
      return s.title === targetModuleTitle;
    }
  });

  return { coreSections, moduleSections };
}
