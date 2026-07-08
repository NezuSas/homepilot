import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
          {copy.analogMinimal}
        </div>
        <div className="shrink-0 rounded-full border border-border/60 bg-background/45 px-[0.75em] py-[0.36em] text-[clamp(0.48rem,2.8cqi,0.64rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {compactDate}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.25rem,2cqi,0.45rem)] py-[clamp(0.05rem,1.5cqi,0.35rem)]">
        <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
        <div className="text-center text-[clamp(1.4rem,13cqi,2.9rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
          {time}
        </div>
      </div>

      <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
    </ClockShell>
  );
}