import type { ClockCopy } from './clockTypes';

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function to12Hour(hour: number): number {
  return hour % 12 || 12;
}

export function getPeriod(hour: number, copy: ClockCopy): string {
  return hour < 12 ? copy.am : copy.pm;
}

export function getClockLocale(): string {
  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement.lang;
    if (htmlLang) return normalizeLocale(htmlLang);
  }

  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language || navigator.languages?.[0];
    if (navLang) return normalizeLocale(navLang);
  }

  return 'es-EC';
}

export function normalizeLocale(locale: string): string {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-EC';
  return locale;
}

export function getClockCopy(locale: string): ClockCopy {
  const language = locale.toLowerCase().startsWith('en') ? 'en' : 'es';

  if (language === 'en') {
    return {
      localTime: 'Local time',
      digitalPro: 'Digital pro',
      homeTime: 'Home time',
      residentialEdge: 'Residential edge',
      sync: 'Sync',
      secondsShort: 'sec',
      am: 'AM',
      pm: 'PM',
    };
  }

  return {
    localTime: 'Hora local',
    digitalPro: 'Digital pro',
    homeTime: 'Hora del hogar',
    residentialEdge: 'Residencial',
    sync: 'Sync',
    secondsShort: 'seg',
    am: 'AM',
    pm: 'PM',
  };
}

export function formatWeekday(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale, { weekday: format }).format(now);
}

export function formatMonth(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale, { month: format }).format(now);
}

export function formatDateLine(now: Date, locale: string): string {
  const language = locale.toLowerCase().startsWith('en') ? 'en' : 'es';
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short');
  const day = now.getDate();
  const year = now.getFullYear();

  if (language === 'en') {
    return `${weekday}, ${month} ${day}, ${year}`;
  }

  return `${weekday}, ${day} ${month} ${year}`;
}

export function getMinuteProgress(now: Date): number {
  return Math.round(((now.getSeconds() + 1) / 60) * 100);
}

export function getDayProgress(now: Date): number {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return Math.round((seconds / 86400) * 100);
}

export function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}