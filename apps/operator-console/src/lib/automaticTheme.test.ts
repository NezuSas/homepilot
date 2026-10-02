import { getScheduledTheme, nextThemeBoundaryDelay } from './automaticTheme';

describe('automatic local theme schedule', () => {
  it.each([[5, 59, 'dark'], [6, 0, 'light'], [18, 29, 'light'], [18, 30, 'dark'], [23, 59, 'dark']] as const)('uses the correct theme at %s:%s', (hours, minutes, theme) => {
    expect(getScheduledTheme(new Date(2026, 9, 1, hours, minutes))).toBe(theme);
  });
  it('schedules the exact next boundary, including the next day', () => {
    expect(nextThemeBoundaryDelay(new Date(2026, 9, 1, 18, 29, 59))).toBe(1000);
    expect(nextThemeBoundaryDelay(new Date(2026, 9, 1, 5, 59, 59))).toBe(1000);
    expect(nextThemeBoundaryDelay(new Date(2026, 9, 1, 23, 0))).toBe(7 * 60 * 60 * 1000);
  });
});
