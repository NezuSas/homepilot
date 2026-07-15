import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
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
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <ClockLabel>{copy.analogMinimal}</ClockLabel>
              <div className="shrink-0 rounded-full border border-border/55 bg-background/40 px-3 py-1 text-clock-minimal-label-fluid font-black uppercase tracking-control text-muted-foreground">
                {compactDate}
              </div>
            </div>
          </div>
          <div className="text-clock-minimal-time-fluid font-black leading-none tracking-clock-tight text-foreground tabular-nums">
            {time}
          </div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
        </div>
      </div>
    </ClockShell>
  );
}
