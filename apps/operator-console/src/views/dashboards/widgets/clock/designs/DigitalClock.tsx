import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

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
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3.1cqi,0.74rem)] font-black uppercase tracking-[0.38em] text-primary">
            {copy.digitalPro}
          </div>
          <div className="mt-1 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center rounded-full border border-border/60 bg-background/50 px-[0.7em] py-[0.55em] text-center shadow-inner shadow-black/10">
          <span className="text-[clamp(0.72rem,4cqi,0.95rem)] font-black leading-none tabular-nums text-foreground">{seconds}</span>
          <span className="mt-0.5 text-[clamp(0.42rem,2.2cqi,0.58rem)] font-black uppercase tracking-[0.16em] text-primary">{copy.secondsShort}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.2rem,2cqi,0.65rem)]">
        <div className="max-w-full rounded-[clamp(1.4rem,8cqi,2.3rem)] border border-border/60 bg-background/45 px-[clamp(0.65rem,5cqi,1.35rem)] py-[clamp(0.35rem,3cqi,0.75rem)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_50px_hsl(var(--background)/0.3)] backdrop-blur-xl">
          <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        <span className="shrink-0 text-[clamp(0.48rem,2.8cqi,0.66rem)] font-black uppercase tracking-[0.18em] text-primary">
          {copy.sync} {progress}%
        </span>
        <div className="col-span-2">
          <ClockProgress value={progress} />
        </div>
      </div>
    </ClockShell>
  );
}