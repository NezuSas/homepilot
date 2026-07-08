import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, getMinuteProgress, getPeriod, pad, titleCase, to12Hour } from '../clockUtils';

export function DigitalClock({ now, locale, copy }: ClockDesignProps) {
  const hour = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const month = titleCase(formatMonth(now, locale, 'short'));
  const day = now.getDate();

  return (
    <div className="relative isolate flex h-full w-full select-none flex-col overflow-hidden rounded-[inherit] border border-border/40 bg-card/80 p-4 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.13] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute inset-x-5 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute right-3 top-3 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[clamp(0.58rem,1.45cqi,0.78rem)] font-black uppercase tracking-[0.28em] text-primary">
            {copy.digitalPro}
          </div>
          <div className="mt-1 truncate text-[clamp(0.54rem,1.25cqi,0.7rem)] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {month} {day}
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-center shadow-sm backdrop-blur-md">
          <span className="text-[clamp(0.78rem,2cqi,1rem)] font-black tabular-nums leading-none text-foreground">{seconds}</span>
          <span className="mt-0.5 text-[0.45rem] font-black uppercase tracking-[0.12em] text-primary">{copy.secondsShort}</span>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-3">
        <div className="relative flex items-center rounded-[2rem] border border-border/60 bg-background/62 px-[clamp(1rem,4cqi,2rem)] py-[clamp(0.8rem,3cqi,1.2rem)] shadow-[0_22px_60px_hsl(var(--background)/0.28),inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
          <div className="flex items-center font-black leading-none tracking-[-0.08em] text-foreground" style={{ fontSize: 'clamp(2.7rem, 11cqi, 6.6rem)' }}>
            <span className="tabular-nums">{hour}</span>
            <span className="mx-[0.045em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.16 }}>:</span>
            <span className="tabular-nums">{minutes}</span>
          </div>
          <span className="ml-3 self-end pb-[0.3em] text-[clamp(0.58rem,1.45cqi,0.78rem)] font-black uppercase tracking-[0.2em] text-primary">
            {period}
          </span>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="text-[clamp(0.5rem,1.2cqi,0.68rem)] font-black uppercase tracking-[0.22em] text-muted-foreground">
          {copy.sync}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/50">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-linear" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[clamp(0.5rem,1.2cqi,0.68rem)] font-black tabular-nums tracking-[0.16em] text-primary">
          {progress}%
        </span>
      </div>
    </div>
  );
}