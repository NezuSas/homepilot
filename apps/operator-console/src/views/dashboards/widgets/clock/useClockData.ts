import { useEffect, useMemo, useState } from 'react';
import { getClockCopy, getClockLocale, normalizeLocale } from './clockUtils';
import { useCuencaWeather } from './useCuencaWeather';

/** Shared live source for the Dashboard Clock and Inicio summaries. */
export function useClockData(language: string) {
  const [now, setNow] = useState(() => new Date());
  const locale = useMemo(() => normalizeLocale(language || getClockLocale()), [language]);
  const copy = useMemo(() => getClockCopy(locale), [locale]);
  const { weather, status: weatherStatus } = useCuencaWeather(locale);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return { now, locale, copy, weather, weatherStatus };
}
