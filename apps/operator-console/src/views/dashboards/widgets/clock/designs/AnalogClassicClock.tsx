import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-[clamp(0.4rem,3cqi,0.8rem)] @[230px]:flex-row @[230px]:items-center @[230px]:justify-between">
        <div className="flex min-h-0 shrink-0 items-center justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-[clamp(0.35rem,2cqi,0.65rem)] text-center @[230px]:text-left">
          <div className="min-w-0">
            <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
              {copy.analogClassic}
            </div>
            <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
              {weekday}
            </div>
          </div>
          <div className="text-[clamp(1.45rem,14cqi,3rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
            {time}
          </div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        </div>
      </div>
    </ClockShell>
  );
}