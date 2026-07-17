import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, formatTemperature, formatWeather, getDayProgress, isDaytimeHour, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, TimeText } from './ClockShared';
import { getWeatherCategory, WeatherScene } from './WeatherScene';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);
  const isReady = Boolean(weather) && weatherStatus === 'ready';
  const category = isReady ? getWeatherCategory(weather!.code, isDaytimeHour(now)) : null;
  const conditionLabel = formatWeather(weather, weatherStatus, copy, 'full');

  return (
    <ClockShell className="p-clock-shell-roomy">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.localTime}</ClockLabel>
            <div className="mt-2 truncate text-clock-caption-fluid font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-clock-micro-fluid font-black uppercase tracking-status text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        {/* Weather takes center stage, Home Assistant weather-card style: a
            big animated scene next to the condition, with the clock itself
            shrunk down beside it instead of dominating the card. */}
        <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 py-clock-section-y-compact">
          <WeatherScene category={category ?? 'cloudy'} size="lg" />
          <div className="min-w-0">
            <TimeText hours={hours} minutes={minutes} blink={blink} size="medium" align="left" />
            {isReady && (
              <div className="mt-1 truncate text-clock-caption-fluid font-black text-foreground">
                {weather!.label} &middot; {formatTemperature(weather!.temperature)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="min-w-0 overflow-hidden rounded-full border border-border/55 bg-background/30 px-widget-pad-x py-widget-spacer shadow-inner">
            <span className="block min-w-0 truncate text-clock-label-fluid font-black uppercase tracking-micro text-foreground">
              {conditionLabel}
            </span>
          </div>
          <ClockProgress value={dayProgress} label={copy.dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}
