import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell className="text-foreground">
      <div className="grid h-full min-w-0 grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] items-center gap-[clamp(0.8rem,3cqi,1.6rem)] p-[clamp(0.9rem,3cqi,1.5rem)] max-[420px]:grid-cols-1">
        <div className="flex min-h-0 items-center justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="grid min-w-0 content-center gap-[clamp(0.55rem,2cqi,0.95rem)] max-[420px]:text-center">
          <div className="min-w-0">
            <p className="truncate text-[clamp(0.52rem,1.45cqi,0.72rem)] font-black uppercase tracking-[0.34em] text-primary">{copy.analogClassic}</p>
            <p className="mt-1 truncate text-[clamp(0.62rem,1.7cqi,0.86rem)] font-semibold text-muted-foreground">{weekday}</p>
          </div>
          <div className="text-[clamp(2.1rem,8cqi,4.2rem)] font-black leading-none tracking-[-0.08em] tabular-nums text-foreground">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        </div>
      </div>
    </ClockShell>
  );
}