import type { ClockDesignProps } from '../clockTypes';
import { formatAmbientDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherLine } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const dateLine = formatAmbientDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell tone="neutral" className="p-clock-shell">
      <div
        className="relative z-10 grid h-full min-h-0 min-w-0 items-center gap-clock-gap-layout-lg"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
      >
        <div className="grid min-w-0 place-items-center">
          <AnalogDial
            hourAngle={angles.hour}
            minuteAngle={angles.minute}
            secondAngle={angles.second}
            minimal
            className="!h-clock-dial-minimal !w-clock-dial-minimal"
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-clock-gap">
          <p className="text-body-lg font-medium text-foreground">{dateLine}</p>
          <div className="text-body font-medium text-muted-foreground tabular-nums">{time}</div>
          <div className="border-t border-border/55 pt-clock-gap-compact">
            <WeatherLine weather={weather} status={weatherStatus} copy={copy} />
          </div>
        </div>
      </div>
    </ClockShell>
  );
}
