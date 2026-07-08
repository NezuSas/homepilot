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
  const compactDate = formatCompactDate(now, locale).split(' ');
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell className="text-foreground">
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.7rem,2.5cqi,1.2rem)] p-[clamp(0.9rem,3cqi,1.55rem)]">
        <header className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[clamp(0.52rem,1.5cqi,0.72rem)] font-black uppercase tracking-[0.38em] text-primary">{label}</p>
            <p className="mt-1 truncate text-[clamp(0.58rem,1.7cqi,0.84rem)] font-semibold text-muted-foreground">{weekday}</p>
          </div>
          <div className="grid h-[clamp(3rem,9cqi,4.2rem)] w-[clamp(3rem,9cqi,4.2rem)] shrink-0 place-items-center rounded-[1.25rem] border border-primary/25 bg-primary/10 text-primary">
            <div className="text-center font-black leading-none">
              <div className="text-[clamp(0.48rem,1.4cqi,0.68rem)] uppercase tracking-[0.18em]">{compactDate[1] ?? ''}</div>
              <div className="mt-1 text-[clamp(1rem,4cqi,1.55rem)] tabular-nums">{compactDate[0]}</div>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-col justify-end gap-2">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} align="left" />
          <div className="h-px w-full bg-gradient-to-r from-primary/60 via-border/45 to-transparent" />
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-3 max-[420px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <div className="min-w-[clamp(5rem,17cqi,8rem)] max-[420px]:min-w-0">
            <ClockProgress value={dayProgress} label={copy.residentialEdge} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}