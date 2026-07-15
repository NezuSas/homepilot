import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, TimeText, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell className="p-[clamp(1rem,3.2cqi,1.8rem)]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.localTime}</ClockLabel>
            <div className="mt-2 truncate text-clock-caption-fluid font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-clock-micro-fluid font-black uppercase tracking-[0.18em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center py-[clamp(0.6rem,2cqi,1.2rem)]">
          <TimeText hours={hours} minutes={minutes} blink={blink} size="hero" />
        </div>

        <div className="space-y-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="full" />
          <ClockProgress value={dayProgress} label={copy.dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}
