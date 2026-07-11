import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell tone="analog" className="p-[clamp(0.85rem,2.4cqi,1.35rem)]">
      <div className="relative z-10 grid h-full min-h-0 min-w-0 items-center gap-[clamp(0.85rem,3cqi,1.45rem)]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="grid min-w-0 place-items-center">
          <AnalogDial
            hourAngle={angles.hour}
            minuteAngle={angles.minute}
            secondAngle={angles.second}
            premium
            className="!h-[clamp(7.5rem,23cqi,11.25rem)] !w-[clamp(7.5rem,23cqi,11.25rem)]"
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(0.55rem,1.7cqi,0.85rem)]">
          <div>
            <ClockLabel>{copy.analogClassic}</ClockLabel>
            <div className="mt-2 text-[clamp(0.58rem,1.3cqi,0.78rem)] font-semibold text-muted-foreground">{weekday}</div>
          </div>
          <div className="text-[clamp(2.5rem,8.2cqi,4.45rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
        </div>
      </div>
    </ClockShell>
  );
}
