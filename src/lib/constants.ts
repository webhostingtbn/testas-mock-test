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

/** Number of questions per section */
export const QUESTIONS_PER_SECTION = {
  FIGURE_SEQUENCE: 20,
  MATH_EQUATION: 20,
  LATIN_SQUARE: 20,
  MODULE_TEST: 20,  // Variable: 5-20
} as const;

/** Major display labels */
export const MAJOR_LABELS: Record<string, string> = {
  economics: 'Economics',
  engineering: 'Engineering',
  natural_computer_science: 'Natural & Computer Science',
} as const;

/** Module test display labels */
export const MODULE_TEST_LABELS: Record<string, string> = {
  economics: 'Economics',
  engineering: 'Engineering',
  math_computer_natural_science: 'Natural Science and Computer Science',
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
    value: 'math_computer_natural_science' as const,
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
