# HomePilot Clock V12 - Remove deprecated clock designs
# Deletes Digital Editorial and Analog Orbital completely.
# Run from repo root on Windows:
# powershell -ExecutionPolicy Bypass -File .\apply-homepilot-clock-v12-remove-deprecated.ps1

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and !(Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  $fullPath = Join-Path (Resolve-Path -LiteralPath $directory).Path (Split-Path -Leaf $Path)
  [System.IO.File]::WriteAllText($fullPath, $Content, $encoding)
}

$root = "apps/operator-console/src/views/dashboards/widgets/clock"

# 1) Remove deprecated design files from disk
Remove-Item "$root/designs/ElegantClock.tsx" -Force -ErrorAction SilentlyContinue
Remove-Item "$root/designs/AnalogOrbitClock.tsx" -Force -ErrorAction SilentlyContinue

# 2) Restrict ClockStyle to only the four final product styles
Write-Utf8NoBom "$root/clockTypes.ts" @'
import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle =
  | 'minimal'
  | 'digital'
  | 'analog-classic'
  | 'analog-minimal';

export interface ClockWeather {
  temperature: number;
  code: number;
  windSpeed?: number;
  updatedAt: string;
  location: string;
  label: string;
}

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
  locale: string;
  copy: ClockCopy;
  weather: ClockWeather | null;
  weatherStatus: 'idle' | 'loading' | 'ready' | 'error';
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
  labelEs: string;
  labelEn: string;
  minW: number;
  minH: number;
}

export interface ClockCopy {
  localTime: string;
  digitalPro: string;
  homeTime: string;
  analogClassic: string;
  analogMinimal: string;
  residentialEdge: string;
  sync: string;
  secondsShort: string;
  dayProgress: string;
  weatherLoading: string;
  weatherUnavailable: string;
  cuenca: string;
  am: string;
  pm: string;
}
'@

# 3) Registry only imports/exports four final designs.
#    Note: legacy DB values are normalized by string before casting.
Write-Utf8NoBom "$root/clockRegistry.ts" @'
import type { ComponentType } from 'react';
import {
  AnalogClassicClock,
  AnalogMinimalClock,
  DigitalClock,
  MinimalClock,
} from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_MIN_LAYOUT = { w: 4, h: 4 } as const;

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'minimal',
    label: 'Digital residencial',
    labelEs: 'Digital residencial',
    labelEn: 'Residential digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'digital',
    label: 'Digital compacto',
    labelEs: 'Digital compacto',
    labelEn: 'Compact digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-classic',
    label: 'Anal\u00f3gico premium',
    labelEs: 'Anal\u00f3gico premium',
    labelEn: 'Premium analog',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-minimal',
    label: 'Anal\u00f3gico minimal',
    labelEs: 'Anal\u00f3gico minimal',
    labelEn: 'Minimal analog',
    minW: 4,
    minH: 4,
  },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  'analog-classic': AnalogClassicClock,
  'analog-minimal': AnalogMinimalClock,
};

export function getClockStyleLabel(style: ClockStyleOption, locale?: string): string {
  return locale?.toLowerCase().startsWith('en') ? style.labelEn : style.labelEs;
}

export function getClockMinimumLayout(style?: ClockStyle): { w: number; h: number } {
  const selected = CLOCK_STYLES.find((item) => item.value === style);
  return { w: selected?.minW ?? CLOCK_MIN_LAYOUT.w, h: selected?.minH ?? CLOCK_MIN_LAYOUT.h };
}

export function isVisibleClockStyle(style: ClockStyle): boolean {
  return CLOCK_STYLES.some((item) => item.value === style);
}

export function normalizeClockStyle(style: unknown): ClockStyle {
  switch (style) {
    case 'digital':
      return 'digital';
    case 'analog-classic':
    case 'analog-orbit':
      return 'analog-classic';
    case 'analog-minimal':
      return 'analog-minimal';
    case 'minimal':
    case 'elegant':
    default:
      return 'minimal';
  }
}
'@

# 4) Export only final design files
Write-Utf8NoBom "$root/designs/index.ts" @'
export { MinimalClock } from './MinimalClock';
export { DigitalClock } from './DigitalClock';
export { AnalogClassicClock } from './AnalogClassicClock';
export { AnalogMinimalClock } from './AnalogMinimalClock';
'@

# 5) ClockWidget accepts unknown legacy DB strings but renders only final designs
Write-Utf8NoBom "$root/ClockWidget.tsx" @'
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../../types';
import { CLOCK_DESIGN_COMPONENTS, normalizeClockStyle } from './clockRegistry';
import { getClockCopy, getClockLocale, normalizeLocale } from './clockUtils';
import { useCuencaWeather } from './useCuencaWeather';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  const locale = useMemo(() => normalizeLocale(i18n.language || getClockLocale()), [i18n.language]);
  const copy = useMemo(() => getClockCopy(locale), [locale]);
  const { weather, status: weatherStatus } = useCuencaWeather(locale);

  const clockStyle = normalizeClockStyle(config.extra?.clockStyle);
  const Design = CLOCK_DESIGN_COMPONENTS[clockStyle] ?? CLOCK_DESIGN_COMPONENTS.minimal;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Design
      now={now}
      config={config}
      locale={locale}
      copy={copy}
      weather={weather}
      weatherStatus={weatherStatus}
    />
  );
}
'@

# 6) Remove obsolete copy fields if references survived elsewhere
$utilsPath = "$root/clockUtils.ts"
if (Test-Path $utilsPath) {
  $utils = Get-Content $utilsPath -Raw
  $utils = $utils -replace "\s*analogOrbit: 'Orbital analog',", ""
  $utils = $utils -replace "\s*analogOrbit: 'Anal\\u00f3gico orbital',", ""
  $utils = $utils -replace "\s*analogOrbit: 'Analógico orbital',", ""
  Write-Utf8NoBom $utilsPath $utils
}

# 7) Remove stale imports if a previous script left them in any clock file
Get-ChildItem "$root" -Recurse -Include *.ts,*.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw

  $content = $content -replace "ElegantClock,\s*", ""
  $content = $content -replace "AnalogOrbitClock,\s*", ""
  $content = $content -replace "export \{ ElegantClock \} from './ElegantClock';\s*", ""
  $content = $content -replace "export \{ AnalogOrbitClock \} from './AnalogOrbitClock';\s*", ""

  Write-Utf8NoBom $_.FullName $content
}

Write-Host "HomePilot Clock V12 applied: deprecated clock designs removed from source."
Write-Host "Deleted:"
Write-Host " - $root/designs/ElegantClock.tsx"
Write-Host " - $root/designs/AnalogOrbitClock.tsx"
Write-Host "Run: npm run build --workspace=apps/operator-console"
