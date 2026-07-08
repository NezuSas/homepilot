import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-cols-[minmax(8rem,0.9fr)_minmax(0,1fr)] items-center gap-[clamp(0.8rem,3cqi,2rem)] p-[clamp(0.95rem,2.5cqi,1.7rem)] max-[520px]:grid-cols-1">
        <div className="grid place-items-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="grid min-w-0 gap-[clamp(0.75rem,2.4cqi,1.3rem)] max-[520px]:place-items-center max-[520px]:text-center">
          <ClockLabel label={copy.analogClassic} subtle={weekday} />
          <div className="text-[clamp(2.2rem,10cqi,4.8rem)] font-black leading-none tracking-[-0.07em] text-foreground tabular-nums">
            {time}
          </div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        </div>
      </div>
    </ClockShell>
  );
}