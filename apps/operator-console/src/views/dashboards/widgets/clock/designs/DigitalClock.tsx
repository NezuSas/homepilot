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
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.digitalPro}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="grid h-[clamp(2.4rem,9cqi,3.5rem)] w-[clamp(2.4rem,9cqi,3.5rem)] place-items-center rounded-full border border-border/50 bg-background/35 text-center shadow-inner">
            <div className="leading-none">
              <div className="text-[clamp(0.8rem,2.7cqi,1.2rem)] font-black tabular-nums">{seconds}</div>
              <div className="mt-0.5 text-[clamp(0.42rem,1.1cqi,0.55rem)] font-black uppercase tracking-[0.15em] text-primary">{copy.secondsShort}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[min(82%,28rem)] items-center justify-center rounded-[2rem] border border-border/50 bg-background/35 px-[clamp(0.8rem,3cqi,1.6rem)] py-[clamp(0.6rem,2.8cqi,1.2rem)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_20px_60px_rgb(0_0_0/0.18)]">
          <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="flex-1" />
            <span className="shrink-0 text-[clamp(0.5rem,1.35cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-primary">{copy.sync} {progress}%</span>
          </div>
          <ClockProgress value={progress} />
        </div>
      </div>
    </ClockShell>
  );
}