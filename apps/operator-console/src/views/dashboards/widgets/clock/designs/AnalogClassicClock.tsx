import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell tone="analog" className="p-clock-shell-compact">
      <div className="relative z-10 grid h-full min-h-0 min-w-0 items-center gap-clock-gap-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="grid min-w-0 place-items-center">
          <AnalogDial
            hourAngle={angles.hour}
            minuteAngle={angles.minute}
            secondAngle={angles.second}
            premium
            className="!h-clock-dial-classic !w-clock-dial-classic"
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-clock-gap-compact">
          <div>
            <ClockLabel>{copy.analogClassic}</ClockLabel>
            <div className="mt-2 text-clock-analog-label-fluid font-semibold text-muted-foreground">{weekday}</div>
          </div>
          <div className="text-clock-analog-time-fluid font-black leading-none tracking-clock-tight text-foreground tabular-nums">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
        </div>
      </div>
    </ClockShell>
  );
}
