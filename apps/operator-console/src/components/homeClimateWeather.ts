import type { ClockWeather } from '../views/dashboards/widgets/clock/clockTypes';

type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

export function getHomeClimateTemperature(weather: ClockWeather | null, status: WeatherStatus): number | null {
  if (status !== 'ready' || !weather || !Number.isFinite(weather.temperature)) return null;
  return Math.round(weather.temperature);
}
