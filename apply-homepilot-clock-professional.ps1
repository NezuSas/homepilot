$ErrorActionPreference = "Stop"

$root = Get-Location
$clockDir = "apps/operator-console/src/views/dashboards/widgets/clock"
$designsDir = "$clockDir/designs"

New-Item -ItemType Directory -Force -Path $clockDir | Out-Null
New-Item -ItemType Directory -Force -Path $designsDir | Out-Null

Set-Content -Path "$clockDir/ClockWidget.tsx" -Encoding UTF8 -Value @'
import { useEffect, useState } from 'react';
import { CLOCK_DESIGNS } from './clockRegistry';
import type { ClockStyle, ClockWidgetProps } from './clockTypes';

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const clockStyle = (config.extra?.clockStyle as ClockStyle) ?? 'minimal';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const ClockDesign = CLOCK_DESIGNS[clockStyle] ?? CLOCK_DESIGNS.minimal;

  return <ClockDesign now={now} config={config} />;
}
'@

Set-Content -Path "$clockDir/clockTypes.ts" -Encoding UTF8 -Value @'
import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle = 'minimal' | 'digital' | 'elegant';

export interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
}
'@

Set-Content -Path "$clockDir/clockUtils.ts" -Encoding UTF8 -Value @'
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTimeOfDay(h: number): string {
  return h < 12 ? 'AM' : 'PM';
}

export function to12h(h: number): number {
  return h % 12 || 12;
}

export function getMinuteProgress(now: Date): number {
  return ((now.getSeconds() + 1) / 60) * 100;
}

export const SHORT_DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;

export const LONG_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

export const UPPER_LONG_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'] as const;

export const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'] as const;

export const LONG_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;
'@

Set-Content -Path "$clockDir/clockRegistry.ts" -Encoding UTF8 -Value @'
import type { ComponentType } from 'react';
import { DigitalClock, ElegantClock, MinimalClock } from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_STYLES: ClockStyleOption[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'digital', label: 'Digital Pro' },
  { value: 'elegant', label: 'Elegante' },
];

export const CLOCK_DESIGNS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
};
'@

Set-Content -Path "$designsDir/MinimalClock.tsx" -Encoding UTF8 -Value @'
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
          <span style={{ color: 'hsl(var(--border))' }}>•</span>
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
'@

Set-Content -Path "$designsDir/DigitalClock.tsx" -Encoding UTF8 -Value @'
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
'@

Set-Content -Path "$designsDir/ElegantClock.tsx" -Encoding UTF8 -Value @'
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
'@

Set-Content -Path "$designsDir/index.ts" -Encoding UTF8 -Value @'
export { MinimalClock } from './MinimalClock';
export { DigitalClock } from './DigitalClock';
export { ElegantClock } from './ElegantClock';
'@

Set-Content -Path "$clockDir/index.ts" -Encoding UTF8 -Value @'
export { ClockWidget } from './ClockWidget';
export { CLOCK_STYLES } from './clockRegistry';
export type { ClockDesignProps, ClockStyle, ClockStyleOption, ClockWidgetProps } from './clockTypes';
'@

Set-Content -Path "apps/operator-console/src/views/dashboards/widgets/ClockWidget.tsx" -Encoding UTF8 -Value @'
export { ClockWidget } from './clock';
export type { ClockStyle } from './clock';
'@

Write-Host "Clock files overwritten with professional designs. Now run: git diff, then npm run build or docker compose up -d --build."
