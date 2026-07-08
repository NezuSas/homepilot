import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, pad } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const progress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.75rem,2.5cqi,1.25rem)] p-[clamp(1rem,3.2cqi,1.6rem)]">
        <header className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.localTime}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[clamp(0.52rem,1.2cqi,0.7rem)] font-black uppercase tracking-[0.14em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </header>

        <main className="flex min-h-0 items-center justify-center">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </main>

        <footer className="min-w-0 space-y-[clamp(0.45rem,1.2cqi,0.75rem)]">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <LinearProgress value={progress} label={copy.dayProgress} />
        </footer>
      </div>
    </ClockShell>
  );
}