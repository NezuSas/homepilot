$ErrorActionPreference = 'Stop'

$clockDir = 'apps/operator-console/src/views/dashboards/widgets/clock'
$designsDir = Join-Path $clockDir 'designs'
New-Item -ItemType Directory -Force -Path $designsDir | Out-Null

function Write-Utf8File {
  param([string]$Path, [string]$Content)
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $dir).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $Path), $Content, [System.Text.UTF8Encoding]::new($false))
}

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/ClockWidget.tsx' -Content @'
export { ClockWidget } from './clock';
export type { ClockStyle } from './clock';
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/clockTypes.ts' -Content @'
import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle = 'minimal' | 'digital' | 'elegant';

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
  locale: string;
  copy: ClockCopy;
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
}

export interface ClockCopy {
  localTime: string;
  digitalPro: string;
  homeTime: string;
  residentialEdge: string;
  sync: string;
  secondsShort: string;
  am: string;
  pm: string;
}
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/clockUtils.ts' -Content @'
import type { ClockCopy } from './clockTypes';

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function to12Hour(hour: number): number {
  return hour % 12 || 12;
}

export function getPeriod(hour: number, copy: ClockCopy): string {
  return hour < 12 ? copy.am : copy.pm;
}

export function getClockLocale(): string {
  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement.lang;
    if (htmlLang) return normalizeLocale(htmlLang);
  }

  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language || navigator.languages?.[0];
    if (navLang) return normalizeLocale(navLang);
  }

  return 'es-EC';
}

export function normalizeLocale(locale: string): string {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-EC';
  return locale;
}

export function getClockCopy(locale: string): ClockCopy {
  const language = locale.toLowerCase().startsWith('en') ? 'en' : 'es';

  if (language === 'en') {
    return {
      localTime: 'Local time',
      digitalPro: 'Digital pro',
      homeTime: 'Home time',
      residentialEdge: 'Residential edge',
      sync: 'Sync',
      secondsShort: 'sec',
      am: 'AM',
      pm: 'PM',
    };
  }

  return {
    localTime: 'Hora local',
    digitalPro: 'Digital pro',
    homeTime: 'Hora del hogar',
    residentialEdge: 'Residencial',
    sync: 'Sync',
    secondsShort: 'seg',
    am: 'AM',
    pm: 'PM',
  };
}

export function formatWeekday(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale, { weekday: format }).format(now);
}

export function formatMonth(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale, { month: format }).format(now);
}

export function formatDateLine(now: Date, locale: string): string {
  const language = locale.toLowerCase().startsWith('en') ? 'en' : 'es';
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short');
  const day = now.getDate();
  const year = now.getFullYear();

  if (language === 'en') {
    return `${weekday}, ${month} ${day}, ${year}`;
  }

  return `${weekday}, ${day} ${month} ${year}`;
}

export function getMinuteProgress(now: Date): number {
  return Math.round(((now.getSeconds() + 1) / 60) * 100);
}

export function getDayProgress(now: Date): number {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return Math.round((seconds / 86400) * 100);
}

export function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/clockRegistry.ts' -Content @'
import type { ComponentType } from 'react';
import { DigitalClock, ElegantClock, MinimalClock } from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_STYLES: ClockStyleOption[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'digital', label: 'Digital Pro' },
  { value: 'elegant', label: 'Elegante' },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
};
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/ClockWidget.tsx' -Content @'
import { useEffect, useMemo, useState } from 'react';
import type { DashboardWidgetConfig } from '../types';
import { CLOCK_DESIGN_COMPONENTS } from './clockRegistry';
import type { ClockStyle } from './clockTypes';
import { getClockCopy, getClockLocale } from './clockUtils';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const locale = useMemo(() => getClockLocale(), []);
  const copy = useMemo(() => getClockCopy(locale), [locale]);
  const clockStyle = (config.extra?.clockStyle as ClockStyle | undefined) ?? 'minimal';
  const Design = CLOCK_DESIGN_COMPONENTS[clockStyle] ?? CLOCK_DESIGN_COMPONENTS.minimal;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <Design now={now} config={config} locale={locale} copy={copy} />;
}
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/designs/index.ts' -Content @'
export { MinimalClock } from './MinimalClock';
export { DigitalClock } from './DigitalClock';
export { ElegantClock } from './ElegantClock';
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/index.ts' -Content @'
export { ClockWidget } from './ClockWidget';
export { CLOCK_STYLES, CLOCK_DESIGN_COMPONENTS } from './clockRegistry';
export type { ClockCopy, ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/designs/MinimalClock.tsx' -Content @'
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
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/designs/DigitalClock.tsx' -Content @'
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
'@

Write-Utf8File -Path 'apps/operator-console/src/views/dashboards/widgets/clock/designs/ElegantClock.tsx' -Content @'
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
'@

$inspector = 'apps/operator-console/src/views/dashboards/WidgetInspector.tsx'
if (Test-Path $inspector) {
  $text = Get-Content -LiteralPath $inspector -Raw -Encoding UTF8
  $text = $text.Replace("import { CLOCK_STYLES, type ClockStyle } from './widgets/clock';", "import { CLOCK_STYLES } from './widgets/clock';")
  $text = $text.Replace("import type { ClockStyle } from './widgets/ClockWidget';", "import { CLOCK_STYLES } from './widgets/clock';")
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $inspector).Path, $text, [System.Text.UTF8Encoding]::new($false))
}

Write-Host 'HomePilot clock widgets updated to Smart Home Clock V2 for Windows.'
