import type { ClockDesignProps } from '../clockTypes';
import { getMinuteProgress, pad, SHORT_DAYS, SHORT_MONTHS } from '../clockUtils';

export function MinimalClock({ now }: ClockDesignProps) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const tick = now.getSeconds() % 2 === 0;

  const dayName = SHORT_DAYS[now.getDay()];
  const monthName = SHORT_MONTHS[now.getMonth()];
  const dayNum = now.getDate();
  const year = now.getFullYear();
  const progress = getMinuteProgress(now);

  return (
    <div className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-[inherit] p-4">
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            'radial-gradient(circle at 18% 15%, hsl(var(--primary)/0.16), transparent 34%), radial-gradient(circle at 82% 82%, hsl(var(--primary)/0.09), transparent 38%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)/0.42), transparent)' }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shadow-[0_0_14px_hsl(var(--primary)/0.55)]"
            style={{ background: 'hsl(var(--primary))' }}
          />
          <span
            className="text-[clamp(0.5rem,1.45cqi,0.68rem)] font-black uppercase tracking-[0.28em]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Local Time
          </span>
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[clamp(0.48rem,1.35cqi,0.65rem)] font-black uppercase tracking-[0.22em]"
          style={{
            borderColor: 'hsl(var(--primary)/0.22)',
            background: 'hsl(var(--primary)/0.08)',
            color: 'hsl(var(--primary))',
          }}
        >
          {s}s
        </span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-2 py-2">
        <div
          className="flex items-baseline font-black tabular-nums leading-none tracking-[-0.065em]"
          style={{ fontSize: 'clamp(2.9rem, 11.5cqi, 7.2rem)', color: 'hsl(var(--foreground))' }}
        >
          <span>{h}</span>
          <span
            className="mx-[0.03em] transition-opacity duration-300"
            style={{ opacity: tick ? 1 : 0.22, color: 'hsl(var(--primary))' }}
          >
            :
          </span>
          <span>{m}</span>
        </div>

        <div className="flex items-center gap-2 text-center">
          <span
            className="text-[clamp(0.58rem,1.8cqi,0.78rem)] font-black uppercase tracking-[0.24em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {dayName}
          </span>
          <span style={{ color: 'hsl(var(--border))' }}>â€¢</span>
          <span
            className="text-[clamp(0.55rem,1.65cqi,0.74rem)] font-bold uppercase tracking-[0.18em]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            {dayNum} {monthName} {year}
          </span>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full"
          style={{ background: 'hsl(var(--muted)/0.55)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, hsl(var(--primary)/0.55), hsl(var(--primary)))',
            }}
          />
        </div>
        <span
          className="text-[clamp(0.48rem,1.35cqi,0.62rem)] font-black tabular-nums tracking-[0.2em]"
          style={{ color: 'hsl(var(--muted-foreground)/0.72)' }}
        >
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
