import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.65rem,2cqi,1rem)] p-[clamp(0.85rem,2.2cqi,1.35rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <ClockLabel label={copy.digitalPro} subtle={dateLine} />
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border/70 bg-background/35 text-center text-[0.58rem] font-black uppercase leading-tight text-primary">
            <span>{seconds}</span>
            <span>{copy.secondsShort}</span>
          </div>
        </div>

        <div className="grid min-h-0 place-items-center">
          <div className="rounded-[2rem] border border-border/65 bg-background/30 px-[clamp(1.2rem,5cqi,2.2rem)] py-[clamp(0.75rem,2.5cqi,1.25rem)] shadow-2xl shadow-black/25">
            <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(72px,0.22fr)] items-end gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress value={progress} label={copy.sync} compact />
        </div>
      </div>
    </ClockShell>
  );
}