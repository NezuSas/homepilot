import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getMinuteProgress, pad } from '../clockUtils';

export function MinimalClock({ now, locale, copy }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const minuteProgress = getMinuteProgress(now);
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <div className="relative isolate flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-[inherit] p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background)/0.42))]" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-foreground/5 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.65)]" />
          <span className="truncate text-[clamp(0.56rem,1.35cqi,0.76rem)] font-black uppercase tracking-[0.24em] text-muted-foreground">
            {copy.localTime}
          </span>
        </div>
        <div className="rounded-full border border-border/70 bg-background/45 px-2.5 py-1 text-[clamp(0.55rem,1.35cqi,0.72rem)] font-black tabular-nums tracking-[0.16em] text-primary shadow-sm backdrop-blur-md">
          {seconds} {copy.secondsShort}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-2">
        <div className="flex items-center justify-center font-black leading-none tracking-[-0.075em] text-foreground drop-shadow-sm" style={{ fontSize: 'clamp(2.9rem, 12cqi, 7.2rem)' }}>
          <span className="tabular-nums">{hours}</span>
          <span className="mx-[0.04em] translate-y-[-0.03em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.18 }}>:</span>
          <span className="tabular-nums">{minutes}</span>
        </div>
        <div className="mt-2 max-w-full truncate text-center text-[clamp(0.62rem,1.55cqi,0.86rem)] font-bold capitalize tracking-[0.08em] text-muted-foreground">
          {dateLine}
        </div>
      </div>

      <div className="relative space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/50">
          <div className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)] transition-[width] duration-700 ease-linear" style={{ width: `${minuteProgress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[clamp(0.48rem,1.1cqi,0.68rem)] font-black uppercase tracking-[0.22em] text-muted-foreground/70">
          <span>{copy.sync}</span>
          <span className="tabular-nums">{dayProgress}%</span>
        </div>
      </div>
    </div>
  );
}