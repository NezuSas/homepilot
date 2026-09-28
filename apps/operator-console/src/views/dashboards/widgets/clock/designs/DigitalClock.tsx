import type { ClockDesignProps } from '../clockTypes';
import { formatAmbientDate, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockShell, TimeText, WeatherLine } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const dateLine = formatAmbientDate(now, locale);

  return (
    <ClockShell tone="neutral" className="p-clock-shell">
      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col items-center justify-between gap-clock-gap text-center">
        <ClockLabel>{copy.localTime}</ClockLabel>
        <TimeText hours={hours} minutes={minutes} period={period} blink={blink} size="medium" />
        <div className="w-full min-w-0 border-t border-border/55 pt-clock-gap-compact">
          <p className="truncate text-body font-medium text-foreground/85">{dateLine}</p>
          <div className="mt-1 flex justify-center"><WeatherLine weather={weather} status={weatherStatus} copy={copy} /></div>
        </div>
      </div>
    </ClockShell>
  );
}
