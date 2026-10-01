export type HomePeriod = 'morning' | 'afternoon' | 'night';

export interface HomePersonalization {
  morningPhrase: string;
  afternoonPhrase: string;
  nightPhrase: string;
  heroImages: Array<{ slot: number; url: string }>;
}

export const EMPTY_HOME_PERSONALIZATION: HomePersonalization = {
  morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [],
};

export const HOME_HERO_INTERVAL_MS = 10_000;
const NIGHT_START_MINUTES = 18 * 60 + 30;

/** Resolve the nearest configured phrase before falling back to product copy. */
export function resolveHomePhrase(settings: HomePersonalization, period: HomePeriod, neutral: string): string {
  const order: Record<HomePeriod, Array<keyof Pick<HomePersonalization, 'morningPhrase' | 'afternoonPhrase' | 'nightPhrase'>>> = {
    morning: ['morningPhrase', 'afternoonPhrase', 'nightPhrase'],
    afternoon: ['afternoonPhrase', 'morningPhrase', 'nightPhrase'],
    night: ['nightPhrase', 'afternoonPhrase', 'morningPhrase'],
  };
  return order[period].map((key) => settings[key].trim()).find(Boolean) || neutral;
}

/** Keep the existing browser-local greeting boundaries shared with the phrase. */
export function getHomePeriod(date: Date): HomePeriod {
  const hour = date.getHours();
  const minutesSinceMidnight = hour * 60 + date.getMinutes();
  return hour < 12 ? 'morning' : minutesSinceMidnight < NIGHT_START_MINUTES ? 'afternoon' : 'night';
}

export function msUntilNextHomePeriod(date: Date): number {
  const next = new Date(date);
  const period = getHomePeriod(date);
  if (period === 'morning') next.setHours(12, 0, 0, 0);
  else if (period === 'afternoon') next.setHours(18, 30, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0); }
  return Math.max(1, next.getTime() - date.getTime());
}
