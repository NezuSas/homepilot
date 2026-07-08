import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-3 p-[clamp(0.9rem,2.3cqi,1.45rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <ClockLabel label={copy.analogOrbit} subtle={dateLine} />
          <div className="shrink-0 text-[clamp(0.6rem,1.4cqi,0.78rem)] font-black uppercase tracking-[0.2em] text-primary">{progress}%</div>
        </div>

        <div className="grid min-h-0 grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] items-center gap-[clamp(0.8rem,3cqi,2rem)] max-[520px]:grid-cols-1">
          <div className="grid place-items-center">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} variant="orbit" />
          </div>
          <div className="text-[clamp(2.6rem,12cqi,5.8rem)] font-black leading-none tracking-[-0.07em] text-foreground tabular-nums max-[520px]:text-center">
            {time}
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress value={progress} compact />
        </div>
      </div>
    </ClockShell>
  );
}