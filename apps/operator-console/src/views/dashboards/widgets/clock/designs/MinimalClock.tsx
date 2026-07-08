import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1.2rem)] p-[clamp(0.9rem,2.5cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <ClockLabel label={copy.localTime} subtle={dateLine} />
          <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[clamp(0.5rem,1.2cqi,0.65rem)] font-black uppercase tracking-[0.16em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        <div className="flex flex-1 min-w-0 items-center justify-center">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </div>

        <div className="grid min-w-0 gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <ClockProgress value={dayProgress} label={copy.dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}