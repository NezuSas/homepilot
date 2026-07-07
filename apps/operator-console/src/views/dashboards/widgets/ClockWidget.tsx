import { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Available clock style designs */
export type ClockStyle = 'minimal' | 'digital' | 'elegant';

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const clockStyle = (config.extra?.clockStyle as ClockStyle) ?? 'minimal';
  const accent = config.appearance?.accentColor;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  switch (clockStyle) {
    case 'digital':
      return <DigitalClock now={now} accent={accent} />;
    case 'elegant':
      return <ElegantClock now={now} accent={accent} config={config} />;
    default:
      return <MinimalClock now={now} accent={accent} />;
  }
}

// ─── Design 1: Minimal ──────────────────────────────────────────────────────
// Large centered time, muted date below. Clean and simple.

function MinimalClock({ now, accent }: { now: Date; accent?: string }) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const tick = now.getSeconds() % 2 === 0;

  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 select-none">
      <div
        className="font-black tabular-nums leading-none tracking-tight"
        style={{ fontSize: 'clamp(2rem, 9cqi, 5.5rem)', color: accent ?? 'hsl(var(--foreground))' }}
      >
        {h}
        <span className="transition-opacity duration-300" style={{ opacity: tick ? 1 : 0.2 }}>:</span>
        {m}
        <span className="text-[0.4em] opacity-40 ml-1">{s}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-[clamp(0.55rem,2cqi,0.8rem)] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent ? `${accent}bb` : 'hsl(var(--muted-foreground))' }}
        >
          {dayName}
        </span>
        <span className="text-[clamp(0.48rem,1.5cqi,0.7rem)] font-medium text-muted-foreground/50 tracking-wide">
          {dateStr}
        </span>
      </div>
    </div>
  );
}

// ─── Design 2: Digital / Scoreboard ─────────────────────────────────────────
// Segmented-display feel, dark background, neon accent.

function DigitalClock({ now, accent }: { now: Date; accent?: string }) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const tick = now.getSeconds() % 2 === 0;
  const color = accent ?? '#22c55e';

  const dayName = now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 select-none rounded-[inherit]"
      style={{ background: 'hsl(var(--card))' }}
    >
      {/* Main time row */}
      <div
        className="font-black tabular-nums leading-none tracking-[0.06em] drop-shadow-[0_0_8px_currentColor]"
        style={{
          fontSize: 'clamp(1.8rem, 8cqi, 5rem)',
          color,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 20px ${color}55`,
        }}
      >
        {h}
        <span
          className="transition-opacity duration-300 mx-0.5"
          style={{ opacity: tick ? 1 : 0.15 }}
        >
          :
        </span>
        {m}
        <span
          className="text-[0.4em] transition-opacity duration-300 ml-1"
          style={{ opacity: tick ? 0.8 : 0.15 }}
        >
          {s}
        </span>
      </div>

      {/* Date line */}
      <div
        className="flex items-center gap-2 text-[clamp(0.5rem,1.8cqi,0.75rem)] font-bold tracking-[0.25em] uppercase"
        style={{ color: `${color}99` }}
      >
        <span>{dayName}</span>
        <span className="opacity-30">·</span>
        <span>{dateStr}</span>
      </div>

      {/* Animated bar */}
      <div className="h-0.5 w-3/4 rounded-full overflow-hidden" style={{ background: `${color}22` }}>
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${((now.getSeconds() + 1) / 60) * 100}%`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Design 3: Elegant / Card ────────────────────────────────────────────────
// Left-aligned, large time on top right, day stacked with a colored label.

function ElegantClock({ now, accent, config }: { now: Date; accent?: string; config: DashboardWidgetConfig }) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const tick = now.getSeconds() % 2 === 0;
  const color = accent ?? 'hsl(var(--primary))';

  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const dayNum = now.getDate();
  const year = now.getFullYear();
  const label = config.appearance?.title || 'Local';

  return (
    <div className="flex h-full w-full flex-col justify-between p-5 select-none">
      {/* Top: label + day */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span
            className="text-[clamp(0.55rem,1.8cqi,0.7rem)] font-black uppercase tracking-[0.25em]"
            style={{ color }}
          >
            {label}
          </span>
          <span className="text-[clamp(0.6rem,2cqi,0.85rem)] font-bold text-muted-foreground/60 capitalize mt-0.5">
            {dayName}
          </span>
        </div>
        <div
          className={cn(
            "flex flex-col items-center justify-center w-10 h-10 rounded-2xl text-center shrink-0",
          )}
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}
        >
          <span className="text-[0.55rem] font-bold uppercase tracking-widest leading-none" style={{ color }}>
            {monthName.slice(0, 3)}
          </span>
          <span className="text-[1.1rem] font-black leading-tight" style={{ color }}>
            {dayNum}
          </span>
        </div>
      </div>

      {/* Bottom: large time */}
      <div
        className="font-black tabular-nums leading-none tracking-tight"
        style={{ fontSize: 'clamp(2rem, 9cqi, 5rem)', color: 'hsl(var(--foreground))' }}
      >
        {h}
        <span
          className="transition-opacity duration-300"
          style={{ opacity: tick ? 1 : 0.2, color }}
        >
          :
        </span>
        {m}
      </div>

      {/* Year subtle */}
      <span className="text-[clamp(0.48rem,1.3cqi,0.65rem)] font-medium text-muted-foreground/30 tracking-widest uppercase">
        {year}
      </span>
    </div>
  );
}
