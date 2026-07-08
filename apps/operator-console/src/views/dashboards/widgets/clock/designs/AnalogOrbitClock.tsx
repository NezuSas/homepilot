import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell className="text-foreground">
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.6rem,2cqi,1rem)] p-[clamp(0.85rem,3cqi,1.35rem)]">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[clamp(0.52rem,1.45cqi,0.72rem)] font-black uppercase tracking-[0.34em] text-primary">{copy.analogOrbit}</p>
            <p className="mt-1 truncate text-[clamp(0.5rem,1.35cqi,0.7rem)] font-semibold text-muted-foreground">{dateLine}</p>
          </div>
          <div className="shrink-0 text-[clamp(0.58rem,1.6cqi,0.8rem)] font-black uppercase tracking-[0.16em] text-primary">{progress}%</div>
        </header>

        <main className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(0.8rem,3cqi,1.5rem)] max-[420px]:grid-cols-1">
          <div className="flex min-h-0 justify-center">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} variant="orbit" />
          </div>
          <div className="text-center text-[clamp(2rem,8cqi,4rem)] font-black leading-none tracking-[-0.08em] tabular-nums text-foreground">{time}</div>
        </main>

        <footer className="grid min-w-0 gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress value={progress} />
        </footer>
      </div>
    </ClockShell>
  );
}