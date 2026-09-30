import { getHomePeriod, msUntilNextHomePeriod } from './homePersonalization';

describe('Feature: Inicio greeting and phrase use the same time period', () => {
  it.each([
    [0, 'morning'], [11, 'morning'], [12, 'afternoon'], [18, 'afternoon'], [19, 'night'], [23, 'night'],
  ] as const)('uses %s:00 as %s', (hour, period) => {
    expect(getHomePeriod(new Date(2026, 8, 30, hour))).toBe(period);
  });

  it('schedules the next period boundary without waiting for a render or sensor event', () => {
    expect(msUntilNextHomePeriod(new Date(2026, 8, 30, 11, 59, 59))).toBe(1000);
    expect(msUntilNextHomePeriod(new Date(2026, 8, 30, 18, 59, 59))).toBe(1000);
  });
});
