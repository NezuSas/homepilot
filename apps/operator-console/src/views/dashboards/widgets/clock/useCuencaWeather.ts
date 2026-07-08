import { useEffect, useMemo, useState } from 'react';
import type { ClockWeather } from './clockTypes';
import { getWeatherDescription, normalizeLocale } from './clockUtils';

const CUENCA_LATITUDE = -2.9006;
const CUENCA_LONGITUDE = -79.0045;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

type WeatherCacheEntry = {
  weather: ClockWeather;
  cachedAt: number;
};

const weatherCache = new Map<string, WeatherCacheEntry>();
const inflightByLocale = new Map<string, Promise<ClockWeather>>();

async function fetchCuencaWeather(localeInput: string): Promise<ClockWeather> {
  const locale = normalizeLocale(localeInput || 'es-EC');
  const now = Date.now();
  const cached = weatherCache.get(locale);

  if (cached && now - cached.cachedAt < WEATHER_CACHE_MS) {
    return cached.weather;
  }

  const inflight = inflightByLocale.get(locale);
  if (inflight) return inflight;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(CUENCA_LATITUDE));
  url.searchParams.set('longitude', String(CUENCA_LONGITUDE));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'America/Guayaquil');

  const request = fetch(url.toString(), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const current = payload.current;
      const code = Number(current.weather_code ?? 0);

      const weather: ClockWeather = {
        temperature: Number(current.temperature_2m ?? 0),
        code,
        windSpeed: Number(current.wind_speed_10m ?? 0),
        updatedAt: String(current.time ?? new Date().toISOString()),
        location: 'Cuenca',
        label: getWeatherDescription(code, locale),
      };

      weatherCache.set(locale, { weather, cachedAt: Date.now() });
      return weather;
    })
    .finally(() => {
      inflightByLocale.delete(locale);
    });

  inflightByLocale.set(locale, request);
  return request;
}

export function useCuencaWeather(localeInput: string) {
  const locale = useMemo(() => normalizeLocale(localeInput || 'es-EC'), [localeInput]);
  const cached = weatherCache.get(locale)?.weather ?? null;

  const [weather, setWeather] = useState<ClockWeather | null>(cached);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(cached ? 'ready' : 'idle');

  useEffect(() => {
    let cancelled = false;

    const loadWeather = () => {
      const currentCached = weatherCache.get(locale)?.weather ?? null;
      if (currentCached) setWeather(currentCached);
      setStatus(currentCached ? 'ready' : 'loading');

      fetchCuencaWeather(locale)
        .then((nextWeather) => {
          if (cancelled) return;
          setWeather(nextWeather);
          setStatus('ready');
        })
        .catch((error) => {
          console.warn('[HomePilot] Weather unavailable', error);
          if (cancelled) return;
          setStatus('error');
        });
    };

    loadWeather();
    const timer = window.setInterval(loadWeather, WEATHER_CACHE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [locale]);

  return { weather, status };
}