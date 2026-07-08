import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell className="text-foreground">
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.55rem,2cqi,1rem)] p-[clamp(0.85rem,3cqi,1.35rem)]">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[clamp(0.52rem,1.45cqi,0.72rem)] font-black uppercase tracking-[0.34em] text-primary">{copy.analogMinimal}</p>
          <span className="shrink-0 rounded-full border border-border/55 bg-background/40 px-2.5 py-1 text-[clamp(0.48rem,1.3cqi,0.65rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">{compactDate}</span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.55rem,2cqi,0.9rem)]">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
          <div className="text-[clamp(2rem,8cqi,4.05rem)] font-black leading-none tracking-[-0.08em] tabular-nums text-foreground">{time}</div>
        </main>

        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}