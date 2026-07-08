import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const compactDate = formatCompactDate(now, locale).split(' ');
  const progress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{label}</ClockKicker>
            <SmallMeta className="mt-2">{formatWeekday(now, locale, 'long')}</SmallMeta>
          </div>
          <div className="grid min-h-[clamp(2.6rem,8cqi,4rem)] min-w-[clamp(2.6rem,8cqi,4rem)] shrink-0 place-items-center rounded-[1.2rem] border border-primary/25 bg-primary/10 px-2 text-center text-primary">
            <span className="text-[clamp(0.48rem,1.2cqi,0.65rem)] font-black uppercase tracking-[0.18em]">{compactDate[1] ?? compactDate[0]}</span>
            <span className="text-[clamp(1rem,3.2cqi,1.6rem)] font-black leading-none">{compactDate[0]}</span>
          </div>
        </header>

        <main className="flex min-h-0 items-end justify-start pb-[clamp(0.25rem,1.2cqi,0.75rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} align="left" />
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-[clamp(0.65rem,2cqi,1rem)] max-[420px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <div className="min-w-[clamp(5rem,16cqi,7rem)]">
            <LinearProgress value={progress} label={copy.residentialEdge} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}