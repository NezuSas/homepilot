import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.7rem,2cqi,1.15rem)] p-[clamp(0.95rem,2.7cqi,1.45rem)]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.digitalPro}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="grid h-[clamp(2.4rem,7.5cqi,3.4rem)] w-[clamp(2.4rem,7.5cqi,3.4rem)] shrink-0 place-items-center rounded-full border border-border/60 bg-background/45 text-center text-[clamp(0.52rem,1.2cqi,0.68rem)] font-black uppercase leading-tight text-primary">
            <span>{seconds}</span>
            <span className="-mt-1 text-[0.68em]">{copy.secondsShort}</span>
          </div>
        </header>

        <main className="flex min-h-0 items-center justify-center">
          <div className="rounded-[clamp(1.35rem,4cqi,2.2rem)] border border-border/55 bg-background/38 px-[clamp(1rem,4cqi,2.8rem)] py-[clamp(0.75rem,2.5cqi,1.35rem)] shadow-[0_18px_50px_hsl(var(--background)/0.35)]">
            <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
          </div>
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-[clamp(0.7rem,2cqi,1rem)] max-[420px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <div className="min-w-[clamp(4.8rem,15cqi,7rem)]">
            <LinearProgress value={progress} label={copy.sync} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}