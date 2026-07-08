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
  const compactDate = formatCompactDate(now, locale);
  const [datePartA, datePartB] = compactDate.split(' ');
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell variant="standard" className="p-[clamp(1rem,3.2cqi,1.75rem)]">
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] gap-[clamp(0.75rem,3cqi,1.5rem)] max-[440px]:grid-cols-1">
        <div className="flex min-h-0 min-w-0 flex-col">
          <ClockLabel>{label}</ClockLabel>
          <div className="mt-2 truncate text-[clamp(0.55rem,1.35cqi,0.76rem)] font-semibold text-muted-foreground">
            {weekday}
          </div>

          <div className="grid min-h-0 flex-1 items-center">
            <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} align="left" scale="medium" />
          </div>

          <div className="space-y-2">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
            <ClockProgress value={dayProgress} label={copy.residentialEdge} mode="minimal" />
          </div>
        </div>

        <div className="flex flex-col items-end justify-between gap-3 max-[440px]:hidden">
          <div className="rounded-[1.45rem] border border-primary/30 bg-primary/10 px-4 py-3 text-center shadow-[0_16px_40px_hsl(var(--primary)/0.08)]">
            <div className="text-[clamp(0.5rem,1.2cqi,0.68rem)] font-black uppercase tracking-[0.28em] text-primary">{datePartA}</div>
            <div className="text-[clamp(1.7rem,4.8cqi,2.6rem)] font-black leading-none text-foreground">{datePartB}</div>
          </div>
        </div>
      </div>
    </ClockShell>
  );
}