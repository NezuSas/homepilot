import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockShell, TimeText, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const dateLine = `${formatWeekday(now, locale)} · ${formatCompactDate(now, locale)}`;

  return (
    <ClockShell tone="neutral" className="p-clock-shell">
      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-3 text-center">
        <TimeText hours={hours} minutes={minutes} period={period} blink={blink} size="medium" />
        <p className="truncate text-body-lg font-semibold text-foreground">{dateLine}</p>
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" className="max-w-full" />
      </div>
    </ClockShell>
  );
}
