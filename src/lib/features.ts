/**
 * Application Feature Flags Configuration
 *
 * Provides a centralized place to turn features ON and OFF.
 *
 * To toggle a feature flag:
 * 1. Via Environment Variable (in `.env` or `.env.local`):
 *    NEXT_PUBLIC_ENABLE_SUBTEST_DRILLS="false" (or "true")
 * 2. Directly in this file:
 *    Change the default fallback value in `FEATURE_FLAGS`.
 */

export interface FeatureFlags {
  /**
   * Subtest Drills Feature:
   * - Shows 'Subtest Drills' in sidebar and mobile navigation
   * - Enables the dedicated SubtestDrillsView to practice individual test sections
   * - Enables single-section drill attempts via API (/api/attempts)
   * - Shows 'Subtest Drills' filter tab in Attempt History
   */
  readonly ENABLE_SUBTEST_DRILLS: boolean;
}

export function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'disabled') {
    return false;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'enabled') {
    return true;
  }
  return defaultValue;
}

export const FEATURE_FLAGS: FeatureFlags = {
  // Toggle Subtest Drills ON/OFF here or via NEXT_PUBLIC_ENABLE_SUBTEST_DRILLS
  ENABLE_SUBTEST_DRILLS: parseEnvBoolean(process.env.NEXT_PUBLIC_ENABLE_SUBTEST_DRILLS, false),
} as const;

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return FEATURE_FLAGS[flag];
}
