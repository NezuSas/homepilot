import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getMinuteProgress, pad } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const minuteProgress = getMinuteProgress(now);
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[clamp(0.55rem,3.2cqi,0.76rem)] font-black uppercase tracking-[0.34em] text-primary">
            <span className="size-[0.7em] shrink-0 rounded-full bg-primary" />
            <span className="truncate">{copy.localTime}</span>
          </div>
          <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-[0.7em] py-[0.36em] text-[clamp(0.52rem,3cqi,0.72rem)] font-black uppercase tracking-[0.16em] text-primary">
          {seconds} {copy.secondsShort}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.2rem,2cqi,0.7rem)]">
        <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(0.35rem,2cqi,0.55rem)]">
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
        <ClockProgress value={minuteProgress} />
        <div className="flex items-center justify-between gap-2 text-[clamp(0.5rem,2.8cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <span>{copy.dayProgress}</span>
          <span>{dayProgress}%</span>
        </div>
      </div>
    </ClockShell>
  );
}