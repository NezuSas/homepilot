export type WeatherCategory =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export function getWeatherCategory(code: number, isDaytime: boolean): WeatherCategory {
  if (code === 0) return isDaytime ? 'clear-day' : 'clear-night';
  if ([1, 2].includes(code)) return isDaytime ? 'partly-cloudy-day' : 'partly-cloudy-night';
  if (code === 3) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';

  return 'cloudy';
}

// A single smooth bezier silhouette (three soft lobes over a rounded base)
// instead of overlapping primitives, so the cloud reads as one clean shape.
export const CLOUD_PATH =
  'M19.5 40C10.9 40 4 33.2 4 24.8C4 17.4 9.4 11.2 16.6 9.8C19.2 4 25.3 0 32.3 0C39.9 0 46.4 4.7 49 11.4C56.9 12.1 63 18.6 63 26.4C63 34.6 56.2 41.2 47.8 41.2H19.5Z';

export type CloudTone = 'day' | 'night' | 'storm' | 'fog';

export const CLOUD_TONES: Record<CloudTone, { top: string; bottom: string; rim: string }> = {
  day:   { top: '#ffffff', bottom: '#d7dee8', rim: '#eef2f7' },
  night: { top: '#e7ecf3', bottom: '#a9b4c4', rim: '#f2f5f9' },
  storm: { top: '#8b95a6', bottom: '#4b5566', rim: '#aab2c0' },
  fog:   { top: '#fbfcfe', bottom: '#cfd7e0', rim: '#ffffff' },
};

export const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 28,
  md: 56,
  lg: 108,
};

/** Horizontal slot of the nth falling particle, spread across the cloud base. */
export function getParticleX(index: number, count: number): number {
  const startX = 20;
  const span = 24;
  return startX + (index * span) / Math.max(1, count - 1);
}
