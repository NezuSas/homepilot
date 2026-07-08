import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell variant="analog" className="p-[clamp(1rem,3.2cqi,1.8rem)]">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[clamp(0.55rem,1.3cqi,0.78rem)] font-black uppercase tracking-[0.38em] text-primary">{copy.analogOrbit}</div>
            <div className="mt-2 truncate text-[clamp(0.52rem,1.2cqi,0.72rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="shrink-0 text-[clamp(0.55rem,1.35cqi,0.8rem)] font-black tabular-nums text-primary">{progress}%</div>
        </div>

        <div className="grid min-h-0 flex-1 items-center gap-[clamp(1rem,4cqi,2rem)] py-[clamp(0.7rem,2cqi,1rem)]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="grid place-items-center">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} variant="orbit" />
          </div>
          <div className="text-[clamp(2.7rem,12cqi,6rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
        </div>

        <div className="space-y-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
          <ClockProgress value={progress} mode="minimal" />
        </div>
      </div>
    </ClockShell>
  );
}