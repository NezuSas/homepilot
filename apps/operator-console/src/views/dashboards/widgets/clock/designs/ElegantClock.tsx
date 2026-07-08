import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const compactDate = formatCompactDate(now, locale);
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
            {label}
          </div>
          <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
            {weekday}
          </div>
        </div>
        <div className="shrink-0 rounded-[clamp(0.85rem,5cqi,1.2rem)] border border-primary/25 bg-primary/10 px-[0.75em] py-[0.55em] text-center">
          <div className="text-[clamp(0.45rem,2.5cqi,0.6rem)] font-black uppercase tracking-[0.2em] text-primary">{compactDate.split(' ')[0]}</div>
          <div className="text-[clamp(0.9rem,5cqi,1.3rem)] font-black leading-none tabular-nums text-foreground">{compactDate.split(' ')[1]}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.1rem,2cqi,0.55rem)]">
        <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} />
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(0.35rem,2cqi,0.55rem)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <span className="shrink-0 rounded-full bg-foreground/7 px-[0.7em] py-[0.35em] text-[clamp(0.46rem,2.6cqi,0.64rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {copy.residentialEdge}
          </span>
        </div>
        <ClockProgress value={dayProgress} />
      </div>
    </ClockShell>
  );
}