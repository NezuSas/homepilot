import type { ClockDesignProps } from '../clockTypes';
import { getMinuteProgress, getTimeOfDay, pad, SHORT_MONTHS, to12h, UPPER_LONG_DAYS } from '../clockUtils';

export function DigitalClock({ now }: ClockDesignProps) {
  const hour12 = pad(to12h(now.getHours()));
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const ampm = getTimeOfDay(now.getHours());
  const tick = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);

  const dayName = UPPER_LONG_DAYS[now.getDay()];
  const month = SHORT_MONTHS[now.getMonth()];
  const dayNum = now.getDate();

  return (
    <div className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-[inherit] p-4">
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            'linear-gradient(135deg, hsl(var(--card)/0.98), hsl(var(--muted)/0.52)), radial-gradient(circle at 100% 0%, hsl(var(--primary)/0.16), transparent 42%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span
            className="text-[clamp(0.48rem,1.35cqi,0.62rem)] font-black uppercase tracking-[0.32em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            Digital Pro
          </span>
          <span
            className="text-[clamp(0.5rem,1.45cqi,0.66rem)] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            {dayName}
          </span>
        </div>
        <div
          className="rounded-2xl border px-2.5 py-1.5 text-right"
          style={{
            borderColor: 'hsl(var(--border)/0.75)',
            background: 'hsl(var(--background)/0.42)',
            boxShadow: 'inset 0 1px 0 hsl(var(--foreground)/0.06)',
          }}
        >
          <div
            className="text-[clamp(0.72rem,2.2cqi,1rem)] font-black leading-none tabular-nums"
            style={{ color: 'hsl(var(--foreground))' }}
          >
            {s}
          </div>
          <div
            className="mt-0.5 text-[clamp(0.42rem,1.2cqi,0.55rem)] font-black uppercase tracking-[0.2em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            SEC
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-2">
        <div
          className="flex items-center rounded-[2rem] border px-4 py-3 shadow-[0_18px_60px_hsl(var(--foreground)/0.08)]"
          style={{
            borderColor: 'hsl(var(--border)/0.82)',
            background: 'hsl(var(--background)/0.34)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <span
            className="font-black tabular-nums leading-none tracking-[-0.045em]"
            style={{ fontSize: 'clamp(2.6rem,10.5cqi,6.8rem)', color: 'hsl(var(--foreground))' }}
          >
            {hour12}
          </span>
          <span
            className="mx-[0.08em] font-black leading-none transition-opacity duration-200"
            style={{ fontSize: 'clamp(2.1rem,8.5cqi,5.4rem)', opacity: tick ? 1 : 0.16, color: 'hsl(var(--primary))' }}
          >
            :
          </span>
          <span
            className="font-black tabular-nums leading-none tracking-[-0.045em]"
            style={{ fontSize: 'clamp(2.6rem,10.5cqi,6.8rem)', color: 'hsl(var(--foreground))' }}
          >
            {m}
          </span>
          <span
            className="ml-3 self-end pb-[0.45em] text-[clamp(0.62rem,2cqi,0.9rem)] font-black uppercase tracking-[0.18em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {ampm}
          </span>
        </div>
      </div>

      <div className="relative space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-[clamp(0.5rem,1.5cqi,0.68rem)] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            {dayNum} {month}
          </span>
          <span
            className="text-[clamp(0.5rem,1.5cqi,0.68rem)] font-black uppercase tracking-[0.22em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            Sync {Math.round(progress)}%
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full"
          style={{ background: 'hsl(var(--muted)/0.62)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%`, background: 'hsl(var(--primary))' }}
          />
        </div>
      </div>
    </div>
  );
}
