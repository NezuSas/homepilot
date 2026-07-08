import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short').replace('.', '');
  const day = now.getDate();
  const year = now.getFullYear();
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="relative z-10 grid h-full w-full select-none grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] gap-3 p-4">
        <div className="min-w-0">
          <div className="text-[clamp(0.52rem,1.6cqi,0.72rem)] font-black uppercase tracking-[0.32em] text-primary">{label}</div>
          <div className="mt-1 truncate text-[clamp(0.58rem,1.75cqi,0.78rem)] font-bold capitalize text-muted-foreground">{weekday}</div>
        </div>

        <div className="flex min-w-12 flex-col items-center rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-primary">
          <span className="text-[clamp(0.48rem,1.35cqi,0.62rem)] font-black uppercase tracking-[0.18em]">{month}</span>
          <span className="text-[clamp(1.15rem,4.2cqi,2rem)] font-black leading-none tabular-nums">{day}</span>
        </div>

        <div className="col-span-2 flex items-center justify-center">
          <div className="flex items-end font-black leading-none tracking-[-0.08em] text-foreground" style={{ fontSize: 'clamp(2.7rem, 13cqi, 7.5rem)' }}>
            <span>{hours}</span>
            <span className="mx-[0.04em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.16 }}>:</span>
            <span>{minutes}</span>
            <span className="mb-[0.42em] ml-2 text-[0.18em] font-black tracking-[0.18em] text-muted-foreground">{seconds}</span>
          </div>
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <span className="shrink-0 text-[clamp(0.48rem,1.45cqi,0.64rem)] font-black uppercase tracking-[0.26em] text-muted-foreground/70">{year}</span>
          <div className="h-px flex-1 bg-border/70" />
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <div className="h-px flex-1 bg-border/40" />
          <span className="shrink-0 text-[clamp(0.48rem,1.45cqi,0.64rem)] font-black uppercase tracking-[0.18em] text-primary">{dayProgress}%</span>
        </div>
      </div>
    </ClockShell>
  );
}