import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getMinuteProgress, pad } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

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
      <div className="relative z-10 flex h-full w-full select-none flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[clamp(0.52rem,1.6cqi,0.72rem)] font-black uppercase tracking-[0.24em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {copy.localTime}
            </div>
            <div className="mt-1 max-w-[14rem] truncate text-[clamp(0.56rem,1.7cqi,0.76rem)] font-bold capitalize text-muted-foreground/80">
              {dateLine}
            </div>
          </div>
          <div className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[clamp(0.5rem,1.5cqi,0.65rem)] font-black uppercase tracking-[0.18em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-2">
          <div className="flex items-baseline justify-center font-black leading-none tracking-[-0.07em] text-foreground" style={{ fontSize: 'clamp(2.7rem, 14cqi, 7.8rem)' }}>
            <span>{hours}</span>
            <span className="mx-[0.04em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.22 }}>:</span>
            <span>{minutes}</span>
          </div>
          <div className="mt-2 flex justify-center">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-1 overflow-hidden rounded-full bg-border/50">
            <div className="h-full rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.45)] transition-[width] duration-700" style={{ width: `${minuteProgress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[clamp(0.48rem,1.45cqi,0.64rem)] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
            <span>{copy.dayProgress}</span>
            <span>{dayProgress}%</span>
          </div>
        </div>
      </div>
    </ClockShell>
  );
}