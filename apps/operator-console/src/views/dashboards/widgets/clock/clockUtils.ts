import type { ClockCopy, ClockWeather } from './clockTypes';

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function to12Hour(hour: number): number {
  return hour % 12 || 12;
}

export function getPeriod(hour: number, copy: ClockCopy): string {
  return hour < 12 ? copy.am : copy.pm;
}

export function normalizeLocale(locale: string): string {
  const normalized = (locale || '').toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-EC';
  return locale || 'es-EC';
}

export function getClockLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return normalizeLocale(document.documentElement.lang);
  }

  if (typeof navigator !== 'undefined') {
    const language = navigator.language || navigator.languages?.[0];
    if (language) return normalizeLocale(language);
  }

  return 'es-EC';
}

export function getClockCopy(locale: string): ClockCopy {
  const isEnglish = normalizeLocale(locale).toLowerCase().startsWith('en');

  if (isEnglish) {
    return {
      localTime: 'Local time',
      digitalPro: 'Compact digital',
      homeTime: 'Home time',
      analogClassic: 'Premium analog',
      analogMinimal: 'Minimal analog',
      residentialEdge: 'Residential edge',
      sync: 'Sync',
      secondsShort: 'sec',
      dayProgress: 'Day',
      weatherLoading: 'Loading weather',
      weatherUnavailable: 'Weather unavailable',
      cuenca: 'Cuenca',
      am: 'AM',
      pm: 'PM',
    };
  }

  return {
    localTime: 'Hora local',
    digitalPro: 'Digital compacto',
    homeTime: 'Hora del hogar',
    analogClassic: 'Anal\u00f3gico premium',
    analogMinimal: 'Anal\u00f3gico minimal',
    residentialEdge: 'Residencial',
    sync: 'Sync',
    secondsShort: 'seg',
    dayProgress: 'D\u00eda',
    weatherLoading: 'Cargando clima',
    weatherUnavailable: 'Clima no disponible',
    cuenca: 'Cuenca',
    am: 'AM',
    pm: 'PM',
  };
}

export function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

export function formatWeekday(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return titleCase(new Intl.DateTimeFormat(normalizeLocale(locale), { weekday: format }).format(now));
}

export function formatMonth(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return titleCase(new Intl.DateTimeFormat(normalizeLocale(locale), { month: format }).format(now));
}

export function formatDateLine(now: Date, locale: string): string {
  const normalized = normalizeLocale(locale);
  const isEnglish = normalized.toLowerCase().startsWith('en');
  const weekday = formatWeekday(now, normalized, 'long');
  const month = formatMonth(now, normalized, 'short').replace('.', '');
  const day = now.getDate();
  const year = now.getFullYear();

  if (isEnglish) return `${weekday}, ${month} ${day}, ${year}`;
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatCompactDate(now: Date, locale: string): string {
  const normalized = normalizeLocale(locale);
  const isEnglish = normalized.toLowerCase().startsWith('en');
  const month = formatMonth(now, normalized, 'short').replace('.', '').toUpperCase();
  const day = now.getDate();

  if (isEnglish) return `${month} ${day}`;
  return `${day} ${month}`;
}

export function getMinuteProgress(now: Date): number {
  return Math.round(((now.getSeconds() + 1) / 60) * 100);
}

export function getDayProgress(now: Date): number {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return Math.round((seconds / 86400) * 100);
}

export function getHandAngles(now: Date) {
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return {
    second: seconds * 6,
    minute: minutes * 6,
    hour: hours * 30,
  };
}

export function getWeatherDescription(code: number, locale: string): string {
  const isEnglish = normalizeLocale(locale).toLowerCase().startsWith('en');

  if (code === 0) return isEnglish ? 'Clear' : 'Despejado';
  if ([1, 2].includes(code)) return isEnglish ? 'Partly cloudy' : 'Parcialmente nublado';
  if (code === 3) return isEnglish ? 'Cloudy' : 'Nublado';
  if ([45, 48].includes(code)) return isEnglish ? 'Fog' : 'Neblina';
  if ([51, 53, 55, 56, 57].includes(code)) return isEnglish ? 'Drizzle' : 'Llovizna';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return isEnglish ? 'Rain' : 'Lluvia';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return isEnglish ? 'Snow' : 'Nieve';
  if ([95, 96, 99].includes(code)) return isEnglish ? 'Storm' : 'Tormenta';

  return isEnglish ? 'Weather' : 'Clima';
}

export function isDaytimeHour(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 6 && hour < 19;
}

export function formatTemperature(value: number): string {
  return `${Math.round(value)}\u00b0C`;
}

export function formatWeather(
  weather: ClockWeather | null,
  status: 'idle' | 'loading' | 'ready' | 'error',
  copy: ClockCopy,
  mode: 'full' | 'compact' | 'temp' = 'full',
): string {
  if (status === 'loading' || status === 'idle') return copy.weatherLoading;
  if (!weather || status === 'error') return copy.weatherUnavailable;

  const temp = formatTemperature(weather.temperature);

  if (mode === 'temp') return `${weather.location} ${temp}`;
  if (mode === 'compact') return `${weather.location} \u2022 ${temp}`;
  return `${weather.location} \u2022 ${weather.label} \u2022 ${temp}`;
}