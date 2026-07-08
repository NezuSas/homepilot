import type { ClockDesignProps } from '../clockTypes';
import { LONG_DAYS, LONG_MONTHS, pad } from '../clockUtils';

export function ElegantClock({ now, config }: ClockDesignProps) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const tick = now.getSeconds() % 2 === 0;

  const dayName = LONG_DAYS[now.getDay()];
  const monthName = LONG_MONTHS[now.getMonth()];
  const dayNum = now.getDate();
  const year = now.getFullYear();
  const label = config.appearance?.title || 'HomePilot';

  return (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden rounded-[inherit] p-4">
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            'radial-gradient(circle at 16% 12%, hsl(var(--primary)/0.18), transparent 32%), linear-gradient(155deg, hsl(var(--card)/0.94), hsl(var(--background)/0.28))',
        }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl"
        style={{ background: 'hsl(var(--primary)/0.18)' }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className="block truncate text-[clamp(0.52rem,1.45cqi,0.68rem)] font-black uppercase tracking-[0.34em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {label}
          </span>
          <span
            className="mt-1 block text-[clamp(0.62rem,1.9cqi,0.82rem)] font-semibold capitalize"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            {dayName}
          </span>
        </div>

        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-3xl border px-3 py-2"
          style={{
            borderColor: 'hsl(var(--primary)/0.24)',
            background: 'hsl(var(--primary)/0.09)',
            boxShadow: 'inset 0 1px 0 hsl(var(--foreground)/0.06)',
          }}
        >
          <span
            className="text-[clamp(0.48rem,1.25cqi,0.58rem)] font-black uppercase tracking-[0.22em] leading-none"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {monthName.slice(0, 3)}
          </span>
          <span
            className="mt-1 text-[clamp(1.2rem,4.3cqi,2rem)] font-black leading-none tabular-nums"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            {dayNum}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 items-end pb-4">
        <div className="w-full">
          <div
            className="mb-3 h-px w-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--primary)/0.48), hsl(var(--border)/0.3), transparent)' }}
          />
          <div
            className="flex items-end font-black tabular-nums leading-none tracking-[-0.07em]"
            style={{ fontSize: 'clamp(3rem, 12.5cqi, 7.4rem)', color: 'hsl(var(--foreground))' }}
          >
            <span>{h}</span>
            <span
              className="mx-[0.035em] transition-opacity duration-300"
              style={{ opacity: tick ? 1 : 0.18, color: 'hsl(var(--primary))' }}
            >
              :
            </span>
            <span>{m}</span>
            <span
              className="mb-[0.38em] ml-3 text-[0.19em] font-black tracking-[0.16em]"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              {s}
            </span>
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <span
          className="text-[clamp(0.5rem,1.45cqi,0.66rem)] font-black uppercase tracking-[0.28em]"
          style={{ color: 'hsl(var(--muted-foreground)/0.72)' }}
        >
          {year}
        </span>
        <div className="h-px flex-1" style={{ background: 'hsl(var(--border)/0.65)' }} />
        <span
          className="rounded-full px-2 py-1 text-[clamp(0.46rem,1.25cqi,0.58rem)] font-black uppercase tracking-[0.22em]"
          style={{ background: 'hsl(var(--muted)/0.5)', color: 'hsl(var(--muted-foreground))' }}
        >
          Residential Edge
        </span>
      </div>
    </div>
  );
}
