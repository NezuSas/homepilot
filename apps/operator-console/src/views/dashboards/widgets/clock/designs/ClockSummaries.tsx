import { Cloud } from 'lucide-react';
import type { ClockCopy, ClockWeather } from '../clockTypes';
import { formatMonth, formatTemperature, formatWeekday, isDaytimeHour, pad } from '../clockUtils';
import { getWeatherCategory, WeatherScene } from './WeatherScene';

export function ClockDateTimeSummary({ now, locale, home = false, homeLabel }: { now: Date; locale: string; home?: boolean; homeLabel?: string }) {
  const isEnglish = locale.toLowerCase().startsWith('en');
  const date = isEnglish
    ? `${formatMonth(now, locale, 'long')} ${now.getDate()}`
    : `${now.getDate()} de ${formatMonth(now, locale, 'long')}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (home) return <div className="homepilot-home-summary flex size-36 shrink-0 flex-col justify-center rounded-card border border-border/60 bg-card/80 p-3 backdrop-blur-md sm:size-40 sm:p-4">
    {homeLabel && <span className="text-micro font-semibold uppercase tracking-control text-muted-foreground">{homeLabel}</span>}
    <time className="block tabular-nums text-panel-title font-bold text-foreground" dateTime={now.toISOString()}>{time}</time>
    <span className="block text-body-compact text-muted-foreground">{formatWeekday(now, locale, 'long')}</span>
    <span className="block text-caption text-muted-foreground">{date}</span>
  </div>;

  return <>
    <div className="homepilot-clock-reference-time tabular-nums">{time}</div>
    <div className="homepilot-clock-reference-weekday">{formatWeekday(now, locale, 'long')}</div>
    <div className="homepilot-clock-reference-date">{date}</div>
  </>;
}

export function ClockWeatherSummary({ now, weather, status, copy, home = false, homeLabel }: {
  now: Date;
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  home?: boolean;
  homeLabel?: string;
}) {
  const ready = status === 'ready' && weather !== null;
  const category = ready ? getWeatherCategory(weather.code, isDaytimeHour(now)) : null;
  const icon = category
    ? <WeatherScene category={category} size={home ? 'sm' : 'md'} className={home ? 'h-5 w-5 shrink-0' : 'homepilot-clock-reference-weather-icon'} />
    : <Cloud aria-hidden="true" className={home ? 'h-5 w-5 shrink-0' : 'homepilot-clock-reference-weather-icon'} />;
  const condition = ready ? weather.label : status === 'idle' || status === 'loading' ? copy.weatherLoading : copy.weatherUnavailable;

  if (home) return <div className="homepilot-home-summary flex size-36 shrink-0 flex-col justify-center rounded-card border border-border/60 bg-card/80 p-3 backdrop-blur-md sm:size-40 sm:p-4" aria-live="polite">
    {homeLabel && <span className="text-micro font-semibold uppercase tracking-control text-muted-foreground">{homeLabel}</span>}
    <div className="flex min-w-0 items-center gap-2 text-body-compact text-muted-foreground">{icon}<span className="truncate">{weather?.location ?? copy.cuenca}</span></div>
    <strong className="block tabular-nums text-panel-title text-foreground">{ready ? formatTemperature(weather.temperature) : '—'}</strong>
    <span className="line-clamp-2 text-caption leading-tight text-muted-foreground">{condition}</span>
  </div>;

  return <div className="homepilot-clock-reference-weather" aria-live="polite">
    {icon}
    <div className="homepilot-clock-reference-weather-info">
      <span className="homepilot-clock-reference-location">{weather?.location ?? copy.cuenca}</span>
      <strong className="homepilot-clock-reference-temperature tabular-nums">{ready ? formatTemperature(weather.temperature) : '—'}</strong>
    </div>
    <div className="homepilot-clock-reference-condition">{condition}</div>
  </div>;
}
