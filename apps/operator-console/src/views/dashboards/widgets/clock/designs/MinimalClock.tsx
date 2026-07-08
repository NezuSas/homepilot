import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getMinuteProgress, pad } from '../clockUtils';
import { AccentDot, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const minuteProgress = getMinuteProgress(now);
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell className="text-foreground">
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.6rem,2cqi,1.1rem)] p-[clamp(0.85rem,3cqi,1.45rem)]">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-[clamp(0.52rem,1.6cqi,0.75rem)] font-black uppercase tracking-[0.34em] text-primary">
              <AccentDot />
              <span className="truncate">{copy.localTime}</span>
            </div>
            <p className="mt-1 truncate text-[clamp(0.52rem,1.5cqi,0.74rem)] font-semibold text-muted-foreground">{dateLine}</p>
          </div>
          <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[clamp(0.48rem,1.4cqi,0.68rem)] font-black uppercase tracking-[0.16em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </main>

        <footer className="grid min-w-0 gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <ClockProgress value={dayProgress || minuteProgress} label={copy.dayProgress} />
        </footer>
      </div>
    </ClockShell>
  );
}