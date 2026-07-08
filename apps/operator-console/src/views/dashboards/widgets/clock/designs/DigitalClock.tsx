import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

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
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)/0.16) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.16) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="relative z-10 flex h-full w-full select-none flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[clamp(0.54rem,1.65cqi,0.74rem)] font-black uppercase tracking-[0.32em] text-primary">{copy.digitalPro}</div>
            <div className="mt-1 max-w-[13rem] truncate text-[clamp(0.5rem,1.5cqi,0.68rem)] font-bold capitalize tracking-[0.08em] text-muted-foreground">{dateLine}</div>
          </div>
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border border-border/55 bg-background/65 shadow-sm backdrop-blur-xl dark:bg-white/[0.04]">
            <span className="text-sm font-black leading-none text-foreground">{seconds}</span>
            <span className="mt-0.5 text-[0.46rem] font-black uppercase tracking-[0.16em] text-primary">{copy.secondsShort}</span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-2">
          <div className="rounded-[2rem] border border-border/60 bg-background/70 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:bg-black/16">
            <div className="flex items-end justify-center font-black leading-none tracking-[-0.075em] text-foreground" style={{ fontSize: 'clamp(2.4rem, 12cqi, 7rem)' }}>
              <span>{hours}</span>
              <span className="mx-[0.04em] text-primary transition-opacity duration-300" style={{ opacity: blink ? 1 : 0.2 }}>:</span>
              <span>{minutes}</span>
              <span className="mb-[0.45em] ml-2 text-[0.22em] font-black tracking-[0.18em] text-primary">{period}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
            <span className="shrink-0 text-[clamp(0.48rem,1.45cqi,0.64rem)] font-black uppercase tracking-[0.18em] text-primary">{copy.sync} {progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-border/50">
            <div className="h-full rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.48)] transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </ClockShell>
  );
}