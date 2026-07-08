import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-2 p-[clamp(0.85rem,2.25cqi,1.35rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <ClockLabel label={copy.analogMinimal} />
          <div className="shrink-0 rounded-full border border-border/55 bg-background/35 px-2.5 py-1 text-[clamp(0.48rem,1.1cqi,0.62rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {compactDate}
          </div>
        </div>

        <div className="grid min-h-0 place-items-center">
          <div className="grid place-items-center gap-[clamp(0.4rem,1.8cqi,0.85rem)]">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
            <div className="text-[clamp(1.9rem,8.5cqi,4.1rem)] font-black leading-none tracking-[-0.07em] text-foreground tabular-nums">
              {time}
            </div>
          </div>
        </div>

        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}