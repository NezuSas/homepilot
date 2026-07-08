import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, SmallMeta, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-cols-[minmax(7rem,0.9fr)_1fr] items-center gap-[clamp(0.8rem,3cqi,1.7rem)] p-[clamp(1rem,3cqi,1.6rem)] max-[460px]:grid-cols-1 max-[460px]:place-items-center">
        <div className="flex min-w-0 items-center justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-[clamp(0.45rem,1.4cqi,0.85rem)] max-[460px]:w-full max-[460px]:items-center">
          <ClockKicker>{copy.analogClassic}</ClockKicker>
          <SmallMeta>{formatWeekday(now, locale, 'short')}</SmallMeta>
          <div className="text-[clamp(2rem,9cqi,4.4rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" tone="solid" />
        </div>
      </div>
    </ClockShell>
  );
}