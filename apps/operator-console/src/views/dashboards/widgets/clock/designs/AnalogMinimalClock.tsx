import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell variant="quiet" className="p-[clamp(1rem,3.2cqi,1.8rem)]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <ClockLabel>{copy.analogMinimal}</ClockLabel>
          <div className="rounded-full border border-border/55 bg-background/40 px-3 py-1 text-[clamp(0.48rem,1.15cqi,0.65rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {compactDate}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center py-[clamp(0.7rem,2.4cqi,1.2rem)]">
          <div className="grid place-items-center gap-[clamp(0.55rem,1.7cqi,0.9rem)]">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
            <div className="text-[clamp(2.1rem,8cqi,4.4rem)] font-black leading-none tracking-[-0.07em] text-foreground tabular-nums">{time}</div>
          </div>
        </div>

        <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
      </div>
    </ClockShell>
  );
}