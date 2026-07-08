import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.55rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex items-start justify-between gap-3">
          <ClockKicker>{copy.analogMinimal}</ClockKicker>
          <div className="shrink-0 rounded-full border border-border/50 bg-background/35 px-3 py-1 text-[clamp(0.5rem,1.25cqi,0.68rem)] font-black uppercase tracking-[0.14em] text-muted-foreground">
            {formatCompactDate(now, locale)}
          </div>
        </header>
        <main className="flex min-h-0 flex-col items-center justify-center gap-[clamp(0.45rem,1.5cqi,0.8rem)]">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
          <div className="text-[clamp(2rem,8cqi,4.6rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
        </main>
        <footer className="min-w-0">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
        </footer>
      </div>
    </ClockShell>
  );
}