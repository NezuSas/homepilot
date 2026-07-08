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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  switch (clockStyle) {
    case 'digital':
      return <DigitalClock now={now} />;
    case 'elegant':
      return <ElegantClock now={now} config={config} />;
    default:
      return <MinimalClock now={now} />;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeOfDay(h: number): string {
  if (h < 12) return 'AM';
  return 'PM';
}

function to12h(h: number): number {
  return h % 12 || 12;
}

// ─── Design 1: Minimal — clean centered glass-style ──────────────────────────

function MinimalClock({ now }: { now: Date }) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const tick = now.getSeconds() % 2 === 0;

  const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const dayName = DAYS[now.getDay()];
  const monthName = MONTHS[now.getMonth()];
  const dayNum = now.getDate();
  const year = now.getFullYear();

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 select-none overflow-hidden p-3">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, hsl(var(--primary)/0.08) 0%, transparent 70%)',
        }}
      />

      {/* Time */}
      <div
        className="relative flex items-end gap-0 font-black tabular-nums leading-none tracking-[-0.04em]"
        style={{ fontSize: 'clamp(2.4rem, 10cqi, 6rem)', color: 'hsl(var(--foreground))' }}
      >
        <span>{h}</span>
        <span
          className="mb-[0.08em] transition-opacity duration-300"
          style={{ opacity: tick ? 1 : 0.15, color: 'hsl(var(--primary))' }}
        >
          :
        </span>
        <span>{m}</span>
        <span
          className="self-end mb-[0.1em] ml-1.5 text-[0.3em] font-bold tabular-nums leading-none"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          {s}
        </span>
      </div>

      {/* Date row */}
      <div className="flex items-center gap-1.5 mt-1">
        <span
          className="text-[clamp(0.5rem,1.8cqi,0.75rem)] font-black uppercase tracking-[0.2em]"
          style={{ color: 'hsl(var(--primary))' }}
        >
          {dayName}
        </span>
        <span className="text-[clamp(0.45rem,1.4cqi,0.6rem)] opacity-20">/</span>
        <span
          className="text-[clamp(0.45rem,1.6cqi,0.7rem)] font-bold uppercase tracking-widest"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          {dayNum} {monthName} {year}
        </span>
      </div>

      {/* Progress bar seconds */}
      <div
        className="mt-1.5 h-0.5 rounded-full overflow-hidden"
        style={{ width: 'min(160px, 60%)', background: 'hsl(var(--primary)/0.12)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${((now.getSeconds() + 1) / 60) * 100}%`,
            background: 'hsl(var(--primary))',
            boxShadow: '0 0 6px hsl(var(--primary))',
            transition: 'width 0.95s linear',
          }}
        />
      </div>
    </div>
  );
}

// ─── Design 2: Digital / Scoreboard — neon terminal aesthetic ─────────────────

function DigitalClock({ now }: { now: Date }) {
  const hour12 = to12h(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const ampm = getTimeOfDay(now.getHours());
  const tick = now.getSeconds() % 2 === 0;

  const DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const dayName = DAYS[now.getDay()];
  const dayNum = now.getDate();
  const month = MONTHS[now.getMonth()];
  const year = now.getFullYear();

  const color = '#22c55e';

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 select-none overflow-hidden rounded-[inherit] p-3"
      style={{ background: '#0a0f0a' }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Hour + Colon + Minutes */}
      <div className="relative flex items-center">
        <span
          className="font-black tabular-nums leading-none tracking-[0.04em]"
          style={{
            fontSize: 'clamp(2.4rem, 10cqi, 6.5rem)',
            color,
            textShadow: `0 0 20px ${color}88, 0 0 40px ${color}44`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pad(hour12)}
        </span>
        <span
          className="mx-0.5 font-black leading-none transition-opacity duration-200"
          style={{
            fontSize: 'clamp(2rem, 9cqi, 5.5rem)',
            color,
            opacity: tick ? 1 : 0.1,
            textShadow: `0 0 16px ${color}`,
          }}
        >
          :
        </span>
        <span
          className="font-black tabular-nums leading-none tracking-[0.04em]"
          style={{
            fontSize: 'clamp(2.4rem, 10cqi, 6.5rem)',
            color,
            textShadow: `0 0 20px ${color}88, 0 0 40px ${color}44`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {m}
        </span>

        {/* Seconds + AM/PM stacked top-right */}
        <div className="ml-1.5 flex flex-col items-start justify-center gap-0.5 self-stretch py-1">
          <span
            className="font-black tabular-nums leading-none text-[clamp(0.65rem,2.5cqi,1.2rem)]"
            style={{ color, textShadow: `0 0 8px ${color}88` }}
          >
            {s}
          </span>
          <span
            className="font-black uppercase leading-none text-[clamp(0.5rem,1.8cqi,0.85rem)] tracking-widest"
            style={{ color: `${color}99` }}
          >
            {ampm}
          </span>
        </div>
      </div>

      {/* Date line */}
      <div
        className="relative flex items-center gap-2 text-[clamp(0.45rem,1.6cqi,0.7rem)] font-bold tracking-[0.3em] uppercase"
        style={{ color: `${color}77` }}
      >
        <span>{dayName}</span>
        <span className="opacity-30">·</span>
        <span>{dayNum} {month} {year}</span>
      </div>

      {/* Progress bar */}
      <div
        className="relative mt-1 overflow-hidden rounded-full"
        style={{ height: '2px', width: 'min(200px, 65%)', background: `${color}18` }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${((now.getSeconds() + 1) / 60) * 100}%`,
            background: color,
            boxShadow: `0 0 8px ${color}, 0 0 16px ${color}66`,
            transition: 'width 0.95s linear',
          }}
        />
      </div>
    </div>
  );
}

// ─── Design 3: Elegant — luxury magazine-style split layout ───────────────────

function ElegantClock({ now, config }: { now: Date; config: DashboardWidgetConfig }) {
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const tick = now.getSeconds() % 2 === 0;

  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayName = DAYS[now.getDay()];
  const monthName = MONTHS[now.getMonth()];
  const dayNum = now.getDate();
  const year = now.getFullYear();
  const label = config.appearance?.title || 'HomePilot';

  return (
    <div className="relative flex h-full w-full flex-col justify-between select-none overflow-hidden p-4">
      {/* Background accent */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-1/3 rounded-[inherit] opacity-30"
        style={{
          background: 'radial-gradient(ellipse 100% 100% at 100% 0%, hsl(var(--primary)/0.2) 0%, transparent 70%)',
        }}
      />

      {/* Top row: label + date badge */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[clamp(0.45rem,1.5cqi,0.65rem)] font-black uppercase tracking-[0.3em]"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {label}
          </span>
          <span
            className="text-[clamp(0.5rem,1.8cqi,0.75rem)] font-semibold capitalize"
            style={{ color: 'hsl(var(--muted-foreground)/0.7)' }}
          >
            {dayName}
          </span>
        </div>

        {/* Date badge */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-2 py-1.5 shrink-0"
          style={{
            background: 'hsl(var(--primary)/0.12)',
            border: '1px solid hsl(var(--primary)/0.25)',
          }}
        >
          <span
            className="text-[clamp(0.4rem,1.2cqi,0.55rem)] font-black uppercase tracking-widest leading-none"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {monthName.slice(0, 3)}
          </span>
          <span
            className="text-[clamp(1rem,4cqi,1.8rem)] font-black leading-tight tabular-nums"
            style={{ color: 'hsl(var(--primary))' }}
          >
            {dayNum}
          </span>
        </div>
      </div>

      {/* Center: large time */}
      <div
        className="flex items-end font-black tabular-nums leading-none tracking-[-0.04em]"
        style={{ fontSize: 'clamp(2.8rem, 12cqi, 7rem)', color: 'hsl(var(--foreground))' }}
      >
        <span>{h}</span>
        <span
          className="transition-opacity duration-300 mx-0.5"
          style={{ opacity: tick ? 1 : 0.15, color: 'hsl(var(--primary))' }}
        >
          :
        </span>
        <span>{m}</span>
      </div>

      {/* Bottom: year + thin separator */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-px rounded-full"
          style={{ background: 'hsl(var(--primary)/0.25)' }}
        />
        <span
          className="text-[clamp(0.4rem,1.3cqi,0.6rem)] font-bold uppercase tracking-[0.3em]"
          style={{ color: 'hsl(var(--muted-foreground)/0.4)' }}
        >
          {year}
        </span>
        <div
          className="flex-1 h-px rounded-full"
          style={{ background: 'hsl(var(--primary)/0.1)' }}
        />
        <span
          className={cn(
            'text-[clamp(0.4rem,1.3cqi,0.6rem)] font-bold uppercase tracking-[0.2em] transition-opacity duration-300',
          )}
          style={{ color: 'hsl(var(--muted-foreground)/0.4)', opacity: tick ? 0.6 : 0.2 }}
        >
          {monthName.slice(0, 3).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
