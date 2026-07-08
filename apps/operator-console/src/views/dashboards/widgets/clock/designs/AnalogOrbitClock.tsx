import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const blink = now.getSeconds() % 2 === 0;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.6rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.analogOrbit}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="shrink-0 text-[clamp(0.6rem,1.5cqi,0.78rem)] font-black tabular-nums text-primary">{progress}%</div>
        </header>

        <main className="grid min-h-0 grid-cols-[1fr_1fr] items-center gap-[clamp(0.5rem,2cqi,1.2rem)] max-[460px]:grid-cols-1">
          <div className="flex justify-center">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} orbit />
          </div>
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} compact align="right" className="max-[460px]:justify-center" />
        </main>

        <footer className="min-w-0 space-y-[clamp(0.4rem,1.2cqi,0.7rem)]">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <LinearProgress value={progress} />
        </footer>
      </div>
    </ClockShell>
  );
}