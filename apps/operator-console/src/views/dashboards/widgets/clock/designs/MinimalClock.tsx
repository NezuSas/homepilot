import type { ClockDesignProps } from '../clockTypes';
import { formatAmbientDate, pad } from '../clockUtils';
import { ClockLabel, ClockShell, TimeText, WeatherLine } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const blink = now.getSeconds() % 2 === 0;
  const dateLine = formatAmbientDate(now, locale);

  return (
    <ClockShell className="p-clock-shell-roomy">
      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col justify-between gap-clock-gap">
        <ClockLabel>{copy.homeTime}</ClockLabel>
        <div className="min-w-0">
          <TimeText hours={hours} minutes={minutes} blink={blink} size="large" align="left" />
          <p className="mt-clock-gap-compact truncate text-body-lg font-medium text-foreground/85">{dateLine}</p>
        </div>
        <div className="min-w-0 border-t border-border/55 pt-clock-gap-compact">
          <WeatherLine weather={weather} status={weatherStatus} copy={copy} />
        </div>
      </div>
    </ClockShell>
  );
}
