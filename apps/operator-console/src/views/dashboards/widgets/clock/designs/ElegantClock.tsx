import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, formatWeekday, pad, titleCase } from '../clockUtils';

export function ElegantClock({ now, config, locale, copy }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const month = titleCase(formatMonth(now, locale, 'short'));
  const weekday = titleCase(formatWeekday(now, locale, 'long'));
  const day = now.getDate();
  const year = now.getFullYear();
  const label = config.appearance?.title || copy.homeTime;

  return (
    <div className="relative isolate flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-[inherit] p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_88%_8%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.94),hsl(var(--background)/0.48))]" />
      <div className="pointer-events-none absolute inset-x-4 bottom-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/80 via-primary/20 to-transparent" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.56rem,1.35cqi,0.76rem)] font-black uppercase tracking-[0.26em] text-primary">
            {label}
          </div>
          <div className="mt-1 truncate text-[clamp(0.7rem,1.7cqi,0.95rem)] font-bold capitalize text-muted-foreground">
            {weekday}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 px-3 py-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur-md">
          <span className="text-[clamp(0.52rem,1.2cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-primary">{month}</span>
          <span className="mt-0.5 text-[clamp(1.1rem,3.4cqi,1.8rem)] font-black leading-none tabular-nums text-foreground">{day}</span>
        </div>
      </div>

      <div className="relative py-3">
        <div className="flex items-end font-black leading-none tracking-[-0.08em] text-foreground" style={{ fontSize: 'clamp(3rem, 12.4cqi, 7.4rem)' }}>
          <span className="tabular-nums">{hours}</span>
          <span className="mx-[0.035em] translate-y-[-0.03em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.18 }}>:</span>
          <span className="tabular-nums">{minutes}</span>
          <span className="mb-[0.28em] ml-3 text-[0.18em] font-black tabular-nums tracking-[0.1em] text-muted-foreground">{seconds}</span>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="text-[clamp(0.5rem,1.15cqi,0.68rem)] font-black tabular-nums tracking-[0.26em] text-muted-foreground/80">
          {year}
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="rounded-full border border-border/70 bg-background/55 px-3 py-1.5 text-[clamp(0.48rem,1.15cqi,0.66rem)] font-black uppercase tracking-[0.2em] text-muted-foreground shadow-sm backdrop-blur-md">
          {copy.residentialEdge}
        </span>
      </div>
    </div>
  );
}