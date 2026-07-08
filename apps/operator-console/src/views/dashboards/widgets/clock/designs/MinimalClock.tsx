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
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.localTime}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[clamp(0.5rem,1.3cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-[clamp(0.4rem,2cqi,1rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </div>

        <div className="grid min-w-0 gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <ClockProgress label={copy.dayProgress} value={dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}