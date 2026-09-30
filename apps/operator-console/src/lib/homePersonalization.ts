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

/** Keep the existing browser-local greeting boundaries shared with the phrase. */
export function getHomePeriod(date: Date): HomePeriod {
  const hour = date.getHours();
  return hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : 'night';
}

export function msUntilNextHomePeriod(date: Date): number {
  const next = new Date(date);
  const hour = date.getHours();
  if (hour < 12) next.setHours(12, 0, 0, 0);
  else if (hour < 19) next.setHours(19, 0, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0); }
  return Math.max(1, next.getTime() - date.getTime());
}
