import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const compactDate = formatCompactDate(now, locale).split(' ');
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] gap-3 p-[clamp(0.9rem,2.4cqi,1.45rem)]">
        <ClockLabel label={label} subtle={weekday} />
        <div className="row-span-2 grid min-w-[4.2rem] place-items-center self-start rounded-3xl border border-primary/25 bg-primary/10 px-3 py-2 text-primary">
          <div className="text-[clamp(0.55rem,1.3cqi,0.7rem)] font-black uppercase tracking-[0.2em]">{compactDate[1] ?? compactDate[0]}</div>
          <div className="text-[clamp(1.25rem,4.5cqi,2rem)] font-black leading-none">{compactDate[0]}</div>
        </div>

        <div className="flex min-w-0 items-end self-end pb-1">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} align="left" />
        </div>

        <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(96px,0.28fr)] items-end gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress value={dayProgress} label={copy.residentialEdge} compact />
        </div>
      </div>
    </ClockShell>
  );
}