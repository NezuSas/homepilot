import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell variant="quiet" className="p-[clamp(1rem,3cqi,1.6rem)]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.digitalPro}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.52rem,1.25cqi,0.72rem)] font-semibold text-muted-foreground">
              {dateLine}
            </div>
          </div>
          <div className="grid h-[clamp(2.8rem,8cqi,4rem)] w-[clamp(2.8rem,8cqi,4rem)] place-items-center rounded-full border border-border/60 bg-background/40 text-center shadow-inner">
            <span className="text-[clamp(0.52rem,1.4cqi,0.78rem)] font-black text-foreground">{seconds}</span>
            <span className="-mt-2 text-[clamp(0.38rem,1cqi,0.5rem)] font-black uppercase tracking-[0.18em] text-primary">{copy.secondsShort}</span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center py-[clamp(0.8rem,2.5cqi,1.4rem)]">
          <div className="rounded-[clamp(1.4rem,4cqi,2.5rem)] border border-border/55 bg-background/34 px-[clamp(1.1rem,4.2cqi,2.3rem)] py-[clamp(0.75rem,2.2cqi,1.2rem)] shadow-[0_22px_60px_hsl(var(--background)/0.26)]">
            <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact scale="medium" />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[460px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
          <div className="min-w-[clamp(4.8rem,16cqi,7rem)] max-[460px]:min-w-0">
            <ClockProgress value={progress} label={copy.sync} mode="minimal" />
          </div>
        </div>
      </div>
    </ClockShell>
  );
}