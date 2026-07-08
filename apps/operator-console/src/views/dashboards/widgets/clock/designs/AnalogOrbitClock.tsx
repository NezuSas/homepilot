import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
            {copy.analogOrbit}
          </div>
          <div className="mt-1 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <span className="shrink-0 text-[clamp(0.52rem,3cqi,0.7rem)] font-black uppercase tracking-[0.2em] text-primary">{progress}%</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-[clamp(0.35rem,3cqi,0.85rem)] py-[clamp(0.1rem,2cqi,0.45rem)] @[230px]:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="min-w-0 text-center @[230px]:text-left">
          <div className="text-[clamp(1.65rem,15cqi,3.5rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
            {time}
          </div>
          <div className="mt-[clamp(0.3rem,2cqi,0.55rem)]">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          </div>
        </div>
      </div>

      <ClockProgress value={progress} />
    </ClockShell>
  );
}