import { getHomePeriod, HOME_HERO_INTERVAL_MS, msUntilNextHomePeriod, resolveHomePhrase, type HomePersonalization } from './homePersonalization';

describe('Feature: Inicio greeting and phrase use the same time period', () => {
  it.each([
    [0, 'morning'], [11, 'morning'], [12, 'afternoon'], [18, 'afternoon'], [19, 'night'], [23, 'night'],
  ] as const)('uses %s:00 as %s', (hour, period) => {
    expect(getHomePeriod(new Date(2026, 8, 30, hour))).toBe(period);
  });

  it('changes from afternoon to night at 18:30 local time', () => {
    expect(getHomePeriod(new Date(2026, 8, 30, 18, 29, 59))).toBe('afternoon');
    expect(getHomePeriod(new Date(2026, 8, 30, 18, 30))).toBe('night');
  });

  it('schedules the next period boundary without waiting for a render or sensor event', () => {
    expect(msUntilNextHomePeriod(new Date(2026, 8, 30, 11, 59, 59))).toBe(1000);
    expect(msUntilNextHomePeriod(new Date(2026, 8, 30, 18, 29, 59))).toBe(1000);
  });

  it.each([
    [{ morningPhrase: 'Morning', afternoonPhrase: '', nightPhrase: '' }, ['Morning', 'Morning', 'Morning']],
    [{ morningPhrase: '', afternoonPhrase: 'Afternoon', nightPhrase: '' }, ['Afternoon', 'Afternoon', 'Afternoon']],
    [{ morningPhrase: '', afternoonPhrase: '', nightPhrase: 'Night' }, ['Night', 'Night', 'Night']],
    [{ morningPhrase: 'Morning', afternoonPhrase: 'Afternoon', nightPhrase: '' }, ['Morning', 'Afternoon', 'Afternoon']],
    [{ morningPhrase: 'Morning', afternoonPhrase: '', nightPhrase: 'Night' }, ['Morning', 'Morning', 'Night']],
    [{ morningPhrase: '', afternoonPhrase: 'Afternoon', nightPhrase: 'Night' }, ['Afternoon', 'Afternoon', 'Night']],
    [{ morningPhrase: 'Morning', afternoonPhrase: 'Afternoon', nightPhrase: 'Night' }, ['Morning', 'Afternoon', 'Night']],
    [{ morningPhrase: '', afternoonPhrase: '', nightPhrase: '' }, ['Neutral', 'Neutral', 'Neutral']],
  ] as const)('resolves available phrases by period priority: %j', (phrases, expected) => {
    const settings: HomePersonalization = { ...phrases, heroImages: [] };
    expect(['morning', 'afternoon', 'night'].map((period) => resolveHomePhrase(settings, period as 'morning' | 'afternoon' | 'night', 'Neutral'))).toEqual(expected);
  });

  it('uses a ten-second hero interval', () => {
    expect(HOME_HERO_INTERVAL_MS).toBe(10_000);
  });
});
