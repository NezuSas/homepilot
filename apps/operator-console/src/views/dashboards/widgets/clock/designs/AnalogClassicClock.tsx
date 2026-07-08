import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-rows-[1fr_auto] gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="grid min-h-0 min-w-0 items-center gap-[clamp(0.7rem,3cqi,1.4rem)] @[28rem]:grid-cols-[0.95fr_1fr]">
          <div className="flex min-w-0 justify-center @[28rem]:justify-end">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
          </div>
          <div className="min-w-0 text-center @[28rem]:text-left">
            <ClockLabel className="justify-center @[28rem]:justify-start">{copy.analogClassic}</ClockLabel>
            <div className="mt-2 text-[clamp(0.62rem,1.6cqi,0.86rem)] font-semibold text-muted-foreground">{weekday}</div>
            <div className="mt-[clamp(0.6rem,2.5cqi,1.2rem)] text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.07em]">{time}</div>
          </div>
        </div>
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}