import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell tone="analog" className="p-[clamp(1rem,3.2cqi,1.9rem)]">
      <div className="relative z-10 grid h-full min-h-0 min-w-0 items-center gap-[clamp(1rem,4cqi,2rem)]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="grid min-w-0 place-items-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} premium />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(0.75rem,2.3cqi,1.15rem)]">
          <div>
            <ClockLabel>{copy.analogClassic}</ClockLabel>
            <div className="mt-2 text-[clamp(0.58rem,1.3cqi,0.78rem)] font-semibold text-muted-foreground">{weekday}</div>
          </div>
          <div className="text-[clamp(2.7rem,10cqi,5.8rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
        </div>
      </div>
    </ClockShell>
  );
}