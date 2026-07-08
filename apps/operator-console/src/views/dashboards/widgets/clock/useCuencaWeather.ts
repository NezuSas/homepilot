import { useEffect, useState } from 'react';
import type { ClockWeather } from './clockTypes';
import { getWeatherDescription } from './clockUtils';

const CUENCA_LATITUDE = -2.9006;
const CUENCA_LONGITUDE = -79.0045;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

let cachedWeather: ClockWeather | null = null;
let cachedAt = 0;
let inflight: Promise<ClockWeather> | null = null;

async function fetchCuencaWeather(locale: string): Promise<ClockWeather> {
  const now = Date.now();
  if (cachedWeather && now - cachedAt < WEATHER_CACHE_MS) return cachedWeather;
  if (inflight) return inflight;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(CUENCA_LATITUDE));
  url.searchParams.set('longitude', String(CUENCA_LONGITUDE));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'America/Guayaquil');

  inflight = fetch(url.toString(), { cache: 'no-store' })
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

      cachedWeather = weather;
      cachedAt = Date.now();
      return weather;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useCuencaWeather(locale: string) {
  const [weather, setWeather] = useState(cachedWeather);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(cachedWeather ? 'ready' : 'idle');

  useEffect(() => {
    let cancelled = false;

    const loadWeather = () => {
      setStatus(cachedWeather ? 'ready' : 'loading');
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