import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { AccentDot, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell className="text-foreground">
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.65rem,2.4cqi,1.15rem)] p-[clamp(0.85rem,3cqi,1.35rem)]">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-[clamp(0.52rem,1.5cqi,0.72rem)] font-black uppercase tracking-[0.34em] text-primary">
              <AccentDot />
              <span className="truncate">{copy.digitalPro}</span>
            </div>
            <p className="mt-1 truncate text-[clamp(0.5rem,1.35cqi,0.7rem)] font-semibold text-muted-foreground">{dateLine}</p>
          </div>
          <div className="flex h-[clamp(2.4rem,7cqi,3.4rem)] w-[clamp(2.4rem,7cqi,3.4rem)] shrink-0 flex-col items-center justify-center rounded-full border border-border/65 bg-card/55 text-[clamp(0.5rem,1.3cqi,0.72rem)] font-black uppercase leading-none text-foreground">
            <span>{seconds}</span>
            <span className="mt-0.5 text-[0.68em] text-primary">{copy.secondsShort}</span>
          </div>
        </header>

        <main className="flex min-h-0 items-center justify-center">
          <div className="min-w-0 rounded-[clamp(1rem,4cqi,2rem)] border border-border/60 bg-background/35 px-[clamp(1rem,5cqi,2.2rem)] py-[clamp(0.55rem,2.4cqi,1rem)] shadow-2xl shadow-black/20">
            <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
          </div>
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-3 max-[420px]:grid-cols-1">
          <div className="min-w-0">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          </div>
          <div className="min-w-[clamp(5rem,18cqi,8rem)] max-[420px]:min-w-0">
            <ClockProgress value={progress} label={copy.sync} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}