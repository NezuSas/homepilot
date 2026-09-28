import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, pad } from '../clockUtils';
import { ClockShell, TimeText, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const blink = now.getSeconds() % 2 === 0;
  const dateLine = `${formatWeekday(now, locale)} · ${formatCompactDate(now, locale)}`;

  return (
    <ClockShell className="p-clock-shell">
      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col justify-center gap-3">
        <TimeText hours={hours} minutes={minutes} blink={blink} size="large" align="left" />
        <p className="truncate text-body-lg font-semibold text-foreground">{dateLine}</p>
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" className="max-w-full self-start" />
      </div>
    </ClockShell>
  );
}
