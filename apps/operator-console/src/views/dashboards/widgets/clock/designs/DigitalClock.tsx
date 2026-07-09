import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, TimeText, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell tone="neutral" className="p-[clamp(1rem,3cqi,1.65rem)]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.digitalPro}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.53rem,1.25cqi,0.72rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="grid h-[clamp(3rem,7.5cqi,4rem)] w-[clamp(3rem,7.5cqi,4rem)] place-items-center rounded-full border border-border/60 bg-background/38 text-center shadow-inner">
            <span className="text-[clamp(0.52rem,1.35cqi,0.78rem)] font-black text-foreground">{seconds}</span>
            <span className="-mt-2 text-[clamp(0.38rem,0.95cqi,0.5rem)] font-black uppercase tracking-[0.18em] text-primary">{copy.secondsShort}</span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center py-[clamp(0.8rem,2.5cqi,1.5rem)]">
          <div className="rounded-[clamp(1.3rem,3.7cqi,2.25rem)] border border-border/55 bg-background/34 px-[clamp(1.15rem,4.2cqi,2.45rem)] py-[clamp(0.8rem,2.1cqi,1.2rem)] shadow-[0_22px_60px_hsl(var(--background)/0.28)]">
            <TimeText hours={hours} minutes={minutes} period={period} blink={blink} size="medium" />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.8rem,7rem)] items-end gap-3 max-[440px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
          <ClockProgress value={progress} label={copy.sync} compact />
        </div>
      </div>
    </ClockShell>
  );
}