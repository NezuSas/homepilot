import type { ClockDesignProps } from '../clockTypes';
import { formatAmbientDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherLine } from './ClockShared';

/** The single presentation for new and historically persisted clock styles. */
export function HomePilotClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);

  return (
    <ClockShell tone="analog" className="homepilot-clock-surface p-clock-shell-compact">
      <div data-homepilot-clock className="relative z-10 flex h-full min-h-0 min-w-0 flex-col justify-between gap-clock-gap">
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-clock-gap-layout">
          <div className="min-w-0">
            <p className="text-body font-medium leading-snug text-muted-foreground">{formatAmbientDate(now, locale)}</p>
            <p className="mt-2 text-clock-time-md-fluid font-semibold leading-none tracking-clock-time tabular-nums text-foreground sm:text-clock-time-lg-fluid">
              {pad(now.getHours())}:{pad(now.getMinutes())}
            </p>
          </div>
          <AnalogDial
            hourAngle={angles.hour}
            minuteAngle={angles.minute}
            secondAngle={angles.second}
            premium
            className="homepilot-clock-dial !h-clock-dial-classic !w-clock-dial-classic max-h-full max-w-full"
          />
        </div>
        <div className="min-w-0 border-t border-border/45 pt-clock-gap-compact">
          <WeatherLine weather={weather} status={weatherStatus} copy={copy} />
        </div>
      </div>
    </ClockShell>
  );
}
