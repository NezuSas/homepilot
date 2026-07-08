import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const date = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <ClockLabel>{copy.analogMinimal}</ClockLabel>
          <div className="shrink-0 rounded-full border border-border/50 bg-background/35 px-3 py-1 text-[clamp(0.48rem,1.25cqi,0.62rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">{date}</div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.45rem,2cqi,1rem)]">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
          <div className="text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.08em]">{time}</div>
        </div>

        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}