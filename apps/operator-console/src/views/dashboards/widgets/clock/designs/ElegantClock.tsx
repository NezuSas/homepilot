import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short').replace('.', '');
  const day = now.getDate();
  const year = now.getFullYear();
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.55rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockLabel>{label}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{weekday}</div>
          </div>
          <div className="grid min-h-[clamp(2.7rem,10cqi,4rem)] min-w-[clamp(2.7rem,10cqi,4rem)] place-items-center rounded-2xl border border-primary/25 bg-primary/10 px-2 text-center text-primary shadow-inner">
            <div className="leading-none">
              <div className="text-[clamp(0.48rem,1.2cqi,0.62rem)] font-black uppercase tracking-[0.18em]">{month}</div>
              <div className="mt-1 text-[clamp(1.05rem,3.5cqi,1.65rem)] font-black tabular-nums">{day}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-[clamp(0.3rem,2cqi,0.8rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} compact />
          <div className="text-[clamp(0.48rem,1.25cqi,0.64rem)] font-black uppercase tracking-[0.24em] text-muted-foreground">{year}</div>
        </div>

        <div className="grid min-w-0 gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress label={copy.dayProgress} value={dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}