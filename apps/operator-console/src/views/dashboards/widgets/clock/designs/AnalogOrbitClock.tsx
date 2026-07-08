import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.analogOrbit}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <span className="shrink-0 text-[clamp(0.58rem,1.4cqi,0.74rem)] font-black tabular-nums tracking-[0.16em] text-primary">{progress}%</span>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 items-center gap-[clamp(0.6rem,3cqi,1.2rem)] @[28rem]:grid-cols-[1fr_0.9fr]">
          <div className="flex justify-center @[28rem]:justify-end">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} orbit />
          </div>
          <div className="min-w-0 text-center @[28rem]:text-left">
            <div className="text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.07em]">{time}</div>
            <div className="mt-3"><WeatherPill weather={weather} status={weatherStatus} copy={copy} compact /></div>
          </div>
        </div>

        <ClockProgress value={progress} />
      </div>
    </ClockShell>
  );
}