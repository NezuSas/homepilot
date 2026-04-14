/**
 * HomeMode Type Definitions
 */
export type HomeMode = 'relax' | 'away' | 'night' | 'energy';

/**
 * Shared Constants
 */
export const VALID_HOME_MODES: HomeMode[] = ['relax', 'away', 'night', 'energy'];
export const DEFAULT_HOME_MODE: HomeMode = 'relax';

/**
 * Safety Helper: Ensures we always have a valid HomeMode string.
 * Prevents "null", "undefined" or raw keys in the UI.
 */
export function getSafeHomeMode(mode: any): HomeMode {
  if (!mode) return DEFAULT_HOME_MODE;
  if (VALID_HOME_MODES.includes(mode as HomeMode)) return mode as HomeMode;
  return DEFAULT_HOME_MODE;
}
