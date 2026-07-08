$ErrorActionPreference = "Stop"

function Write-Utf8File {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $Path -Value $Content -Encoding UTF8 -NoNewline
}

$base = "apps/operator-console/src/views/dashboards/widgets/clock"

Write-Utf8File "$base/ClockWidget.tsx" @'
import { useEffect, useMemo, useState } from 'react';
import type { DashboardWidgetConfig } from '../../types';
import { CLOCK_DESIGN_COMPONENTS } from './clockRegistry';
import type { ClockStyle } from './clockTypes';
import { getClockCopy, getClockLocale } from './clockUtils';
import { useCuencaWeather } from './useCuencaWeather';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const locale = useMemo(() => getClockLocale(), []);
  const copy = useMemo(() => getClockCopy(locale), [locale]);
  const { weather, status: weatherStatus } = useCuencaWeather(locale);

  const clockStyle = (config.extra?.clockStyle as ClockStyle | undefined) ?? 'minimal';
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

Write-Utf8File "$base/clockTypes.ts" @'
import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle =
  | 'minimal'
  | 'digital'
  | 'elegant'
  | 'analog-classic'
  | 'analog-orbit'
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
}

export interface ClockCopy {
  localTime: string;
  digitalPro: string;
  homeTime: string;
  analogClassic: string;
  analogOrbit: string;
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

Write-Utf8File "$base/clockUtils.ts" @'
import type { ClockCopy, ClockWeather } from './clockTypes';

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
      analogClassic: 'Analog classic',
      analogOrbit: 'Analog orbit',
      analogMinimal: 'Analog minimal',
      residentialEdge: 'Residential',
      sync: 'Sync',
      secondsShort: 'sec',
      dayProgress: 'Day',
      weatherLoading: 'Loading weather',
      weatherUnavailable: 'Weather unavailable',
      cuenca: 'Cuenca',
      am: 'AM',
      pm: 'PM',
    };
  }

  return {
    localTime: 'Hora local',
    digitalPro: 'Digital pro',
    homeTime: 'Hora del hogar',
    analogClassic: 'Analógico clásico',
    analogOrbit: 'Analógico órbita',
    analogMinimal: 'Analógico minimal',
    residentialEdge: 'Residencial',
    sync: 'Sync',
    secondsShort: 'seg',
    dayProgress: 'Día',
    weatherLoading: 'Cargando clima',
    weatherUnavailable: 'Clima no disponible',
    cuenca: 'Cuenca',
    am: 'AM',
    pm: 'PM',
  };
}

export function formatWeekday(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return titleCase(new Intl.DateTimeFormat(locale, { weekday: format }).format(now));
}

export function formatMonth(now: Date, locale: string, format: 'short' | 'long' = 'short'): string {
  return titleCase(new Intl.DateTimeFormat(locale, { month: format }).format(now));
}

export function formatDateLine(now: Date, locale: string): string {
  const language = locale.toLowerCase().startsWith('en') ? 'en' : 'es';
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short').replace('.', '');
  const day = now.getDate();
  const year = now.getFullYear();

  if (language === 'en') return `${weekday}, ${month} ${day}, ${year}`;
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatCompactDate(now: Date, locale: string): string {
  const day = now.getDate();
  const month = formatMonth(now, locale, 'short').replace('.', '');
  return `${month} ${day}`;
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
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

export function getHandAngles(now: Date) {
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return {
    second: seconds * 6,
    minute: minutes * 6,
    hour: hours * 30,
  };
}

export function getWeatherDescription(code: number, locale: string): string {
  const isEnglish = locale.toLowerCase().startsWith('en');
  if (code === 0) return isEnglish ? 'Clear' : 'Despejado';
  if ([1, 2].includes(code)) return isEnglish ? 'Partly cloudy' : 'Parcialmente nublado';
  if (code === 3) return isEnglish ? 'Cloudy' : 'Nublado';
  if ([45, 48].includes(code)) return isEnglish ? 'Fog' : 'Neblina';
  if ([51, 53, 55, 56, 57].includes(code)) return isEnglish ? 'Drizzle' : 'Llovizna';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return isEnglish ? 'Rain' : 'Lluvia';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return isEnglish ? 'Snow' : 'Nieve';
  if ([95, 96, 99].includes(code)) return isEnglish ? 'Storm' : 'Tormenta';
  return isEnglish ? 'Weather' : 'Clima';
}

export function formatWeather(
  weather: ClockWeather | null,
  status: 'idle' | 'loading' | 'ready' | 'error',
  copy: ClockCopy,
): string {
  if (status === 'loading' || status === 'idle') return copy.weatherLoading;
  if (!weather || status === 'error') return copy.weatherUnavailable;
  return `${weather.location} · ${Math.round(weather.temperature)}°C · ${weather.label}`;
}
'@

Write-Utf8File "$base/clockRegistry.ts" @'
import type { ComponentType } from 'react';
import {
  AnalogClassicClock,
  AnalogMinimalClock,
  AnalogOrbitClock,
  DigitalClock,
  ElegantClock,
  MinimalClock,
} from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_STYLES: ClockStyleOption[] = [
  { value: 'minimal', label: 'Digital Minimal' },
  { value: 'digital', label: 'Digital Home' },
  { value: 'elegant', label: 'Digital Elegante' },
  { value: 'analog-classic', label: 'Analógico Classic' },
  { value: 'analog-orbit', label: 'Analógico Orbit' },
  { value: 'analog-minimal', label: 'Analógico Minimal' },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
  'analog-classic': AnalogClassicClock,
  'analog-orbit': AnalogOrbitClock,
  'analog-minimal': AnalogMinimalClock,
};
'@

Write-Utf8File "$base/useCuencaWeather.ts" @'
import { useEffect, useState } from 'react';
import type { ClockWeather } from './clockTypes';
import { getWeatherDescription } from './clockUtils';

const CUENCA_LATITUDE = -2.9006;
const CUENCA_LONGITUDE = -79.0045;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

let cachedWeather: ClockWeather | null = null;
let cachedAt = 0;
let inflight: Promise<ClockWeather> | null = null;

async function fetchCuencaWeather(locale: string): Promise<ClockWeather> {
  const now = Date.now();
  if (cachedWeather && now - cachedAt < WEATHER_CACHE_MS) return cachedWeather;
  if (inflight) return inflight;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(CUENCA_LATITUDE));
  url.searchParams.set('longitude', String(CUENCA_LONGITUDE));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'America/Guayaquil');

  inflight = fetch(url.toString(), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const current = payload.current;
      const code = Number(current.weather_code ?? 0);
      const weather: ClockWeather = {
        temperature: Number(current.temperature_2m ?? 0),
        code,
        windSpeed: Number(current.wind_speed_10m ?? 0),
        updatedAt: String(current.time ?? new Date().toISOString()),
        location: 'Cuenca',
        label: getWeatherDescription(code, locale),
      };

      cachedWeather = weather;
      cachedAt = Date.now();
      return weather;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useCuencaWeather(locale: string) {
  const [weather, setWeather] = useState(cachedWeather);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(cachedWeather ? 'ready' : 'idle');

  useEffect(() => {
    let cancelled = false;

    const loadWeather = () => {
      setStatus(cachedWeather ? 'ready' : 'loading');
      fetchCuencaWeather(locale)
        .then((nextWeather) => {
          if (cancelled) return;
          setWeather(nextWeather);
          setStatus('ready');
        })
        .catch((error) => {
          console.warn('[HomePilot] Weather unavailable', error);
          if (cancelled) return;
          setStatus('error');
        });
    };

    loadWeather();
    const timer = window.setInterval(loadWeather, WEATHER_CACHE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [locale]);

  return { weather, status };
}
'@

$designs = "$base/designs"

Write-Utf8File "$designs/ClockShared.tsx" @'
import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';

interface WeatherPillProps {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  compact?: boolean;
  className?: string;
}

export function ClockShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative isolate flex h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[inherit] text-foreground ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            'radial-gradient(circle at 12% 10%, hsl(var(--primary) / 0.14), transparent 34%), linear-gradient(135deg, hsl(var(--card) / 0.96), hsl(var(--background) / 0.72))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(120deg, hsl(var(--foreground) / 0.05) 0 1px, transparent 1px 100%)',
          backgroundSize: '18px 18px',
          maskImage: 'linear-gradient(to bottom, black, transparent 80%)',
        }}
      />
      <div className="relative z-10 flex h-full w-full min-h-0 min-w-0 flex-col justify-between overflow-hidden p-[clamp(0.65rem,5cqi,1.05rem)]">
        {children}
      </div>
    </div>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block size-[0.48em] shrink-0 rounded-full bg-primary ${className}`} />;
}

export function WeatherPill({ weather, status, copy, compact = false, className = '' }: WeatherPillProps) {
  const isReady = Boolean(weather && status === 'ready');
  const label = isReady
    ? compact
      ? weather?.location
      : `${weather?.location} · ${weather?.label}`
    : status === 'error'
      ? copy.weatherUnavailable
      : copy.weatherLoading;

  return (
    <div
      className={`flex max-w-full min-w-0 items-center gap-[0.45em] overflow-hidden rounded-full border border-border/55 bg-background/45 px-[0.75em] py-[0.36em] text-[clamp(0.5rem,3.1cqi,0.7rem)] font-black uppercase leading-none tracking-[0.14em] shadow-inner shadow-black/10 backdrop-blur-xl ${className}`}
    >
      <AccentDot />
      <span className="min-w-0 truncate">{label}</span>
      {isReady && (
        <span className="shrink-0 text-foreground">{Math.round(weather!.temperature)}°</span>
      )}
    </div>
  );
}

export function ClockProgress({ value }: { value: number }) {
  return (
    <div className="h-[clamp(0.16rem,0.9cqi,0.24rem)] w-full overflow-hidden rounded-full bg-foreground/12">
      <div
        className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.38)] transition-[width] duration-700 ease-linear"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function ResponsiveTime({
  hours,
  minutes,
  seconds,
  period,
  blink,
  compact = false,
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-end justify-center gap-[0.02em] whitespace-nowrap font-black leading-none tracking-[-0.065em] text-foreground tabular-nums">
      <span style={{ fontSize: compact ? 'clamp(2.1rem,23cqi,5.6rem)' : 'clamp(2.35rem,25cqi,6.4rem)' }}>{hours}</span>
      <span
        className="px-[0.03em] text-primary transition-opacity duration-300"
        style={{
          fontSize: compact ? 'clamp(2rem,20cqi,5.1rem)' : 'clamp(2.15rem,22cqi,5.8rem)',
          opacity: blink ? 1 : 0.35,
        }}
      >
        :
      </span>
      <span style={{ fontSize: compact ? 'clamp(2.1rem,23cqi,5.6rem)' : 'clamp(2.35rem,25cqi,6.4rem)' }}>{minutes}</span>
      {(seconds || period) && (
        <span className="mb-[0.35em] ml-[0.45em] flex shrink-0 flex-col items-start gap-[0.28em] text-[clamp(0.5rem,3.2cqi,0.78rem)] font-black tracking-[0.16em] text-primary">
          {seconds && <span>{seconds}</span>}
          {period && <span>{period}</span>}
        </span>
      )}
    </div>
  );
}

export function AnalogDial({
  hourAngle,
  minuteAngle,
  secondAngle,
  minimal = false,
}: {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
  minimal?: boolean;
}) {
  const marks = Array.from({ length: 12 });

  return (
    <svg
      viewBox="0 0 120 120"
      className="block shrink-0 overflow-visible"
      style={{ width: 'clamp(4.9rem,42cqi,8.8rem)', height: 'clamp(4.9rem,42cqi,8.8rem)' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hp-clock-dial" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--foreground) / 0.08)" />
          <stop offset="100%" stopColor="hsl(var(--background) / 0.2)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="url(#hp-clock-dial)" stroke="hsl(var(--border) / 0.7)" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="43" fill="transparent" stroke="hsl(var(--primary) / 0.18)" strokeWidth="1" />
      {marks.map((_, index) => {
        const angle = (index * 30 * Math.PI) / 180;
        const inner = minimal ? 43 : index % 3 === 0 ? 40 : 44;
        const outer = 48;
        const x1 = 60 + Math.sin(angle) * inner;
        const y1 = 60 - Math.cos(angle) * inner;
        const x2 = 60 + Math.sin(angle) * outer;
        const y2 = 60 - Math.cos(angle) * outer;
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={index % 3 === 0 ? 'hsl(var(--foreground) / 0.38)' : 'hsl(var(--foreground) / 0.16)'}
            strokeWidth={index % 3 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="34"
        stroke="hsl(var(--foreground))"
        strokeWidth="5"
        strokeLinecap="round"
        transform={`rotate(${hourAngle} 60 60)`}
      />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="24"
        stroke="hsl(var(--foreground) / 0.86)"
        strokeWidth="3.2"
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} 60 60)`}
      />
      <line
        x1="60"
        y1="65"
        x2="60"
        y2="19"
        stroke="hsl(var(--primary))"
        strokeWidth="1.9"
        strokeLinecap="round"
        transform={`rotate(${secondAngle} 60 60)`}
      />
      <circle cx="60" cy="60" r="7" fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="2.5" fill="hsl(var(--background))" />
    </svg>
  );
}
'@

Write-Utf8File "$designs/MinimalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, getMinuteProgress, pad } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const minuteProgress = getMinuteProgress(now);
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[clamp(0.55rem,3.2cqi,0.76rem)] font-black uppercase tracking-[0.34em] text-primary">
            <span className="size-[0.7em] shrink-0 rounded-full bg-primary" />
            <span className="truncate">{copy.localTime}</span>
          </div>
          <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-[0.7em] py-[0.36em] text-[clamp(0.52rem,3cqi,0.72rem)] font-black uppercase tracking-[0.16em] text-primary">
          {seconds} {copy.secondsShort}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.2rem,2cqi,0.7rem)]">
        <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(0.35rem,2cqi,0.55rem)]">
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
        <ClockProgress value={minuteProgress} />
        <div className="flex items-center justify-between gap-2 text-[clamp(0.5rem,2.8cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <span>{copy.dayProgress}</span>
          <span>{dayProgress}%</span>
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/DigitalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell className="text-foreground">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3.1cqi,0.74rem)] font-black uppercase tracking-[0.38em] text-primary">
            {copy.digitalPro}
          </div>
          <div className="mt-1 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center rounded-full border border-border/60 bg-background/50 px-[0.7em] py-[0.55em] text-center shadow-inner shadow-black/10">
          <span className="text-[clamp(0.72rem,4cqi,0.95rem)] font-black leading-none tabular-nums text-foreground">{seconds}</span>
          <span className="mt-0.5 text-[clamp(0.42rem,2.2cqi,0.58rem)] font-black uppercase tracking-[0.16em] text-primary">{copy.secondsShort}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.2rem,2cqi,0.65rem)]">
        <div className="max-w-full rounded-[clamp(1.4rem,8cqi,2.3rem)] border border-border/60 bg-background/45 px-[clamp(0.65rem,5cqi,1.35rem)] py-[clamp(0.35rem,3cqi,0.75rem)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_18px_50px_hsl(var(--background)/0.3)] backdrop-blur-xl">
          <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        <span className="shrink-0 text-[clamp(0.48rem,2.8cqi,0.66rem)] font-black uppercase tracking-[0.18em] text-primary">
          {copy.sync} {progress}%
        </span>
        <div className="col-span-2">
          <ClockProgress value={progress} />
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/ElegantClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const compactDate = formatCompactDate(now, locale);
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
            {label}
          </div>
          <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
            {weekday}
          </div>
        </div>
        <div className="shrink-0 rounded-[clamp(0.85rem,5cqi,1.2rem)] border border-primary/25 bg-primary/10 px-[0.75em] py-[0.55em] text-center">
          <div className="text-[clamp(0.45rem,2.5cqi,0.6rem)] font-black uppercase tracking-[0.2em] text-primary">{compactDate.split(' ')[0]}</div>
          <div className="text-[clamp(0.9rem,5cqi,1.3rem)] font-black leading-none tabular-nums text-foreground">{compactDate.split(' ')[1]}</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-[clamp(0.1rem,2cqi,0.55rem)]">
        <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} />
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(0.35rem,2cqi,0.55rem)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <span className="shrink-0 rounded-full bg-foreground/7 px-[0.7em] py-[0.35em] text-[clamp(0.46rem,2.6cqi,0.64rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {copy.residentialEdge}
          </span>
        </div>
        <ClockProgress value={dayProgress} />
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/AnalogClassicClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-[clamp(0.4rem,3cqi,0.8rem)] @[230px]:flex-row @[230px]:items-center @[230px]:justify-between">
        <div className="flex min-h-0 shrink-0 items-center justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-[clamp(0.35rem,2cqi,0.65rem)] text-center @[230px]:text-left">
          <div className="min-w-0">
            <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
              {copy.analogClassic}
            </div>
            <div className="mt-1 truncate text-[clamp(0.58rem,3.2cqi,0.78rem)] font-semibold text-muted-foreground">
              {weekday}
            </div>
          </div>
          <div className="text-[clamp(1.45rem,14cqi,3rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
            {time}
          </div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/AnalogOrbitClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
            {copy.analogOrbit}
          </div>
          <div className="mt-1 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-semibold text-muted-foreground">
            {dateLine}
          </div>
        </div>
        <span className="shrink-0 text-[clamp(0.52rem,3cqi,0.7rem)] font-black uppercase tracking-[0.2em] text-primary">{progress}%</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-[clamp(0.35rem,3cqi,0.85rem)] py-[clamp(0.1rem,2cqi,0.45rem)] @[230px]:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="min-w-0 text-center @[230px]:text-left">
          <div className="text-[clamp(1.65rem,15cqi,3.5rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
            {time}
          </div>
          <div className="mt-[clamp(0.3rem,2cqi,0.55rem)]">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          </div>
        </div>
      </div>

      <ClockProgress value={progress} />
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/AnalogMinimalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const compactDate = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 truncate text-[clamp(0.55rem,3cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary">
          {copy.analogMinimal}
        </div>
        <div className="shrink-0 rounded-full border border-border/60 bg-background/45 px-[0.75em] py-[0.36em] text-[clamp(0.48rem,2.8cqi,0.64rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {compactDate}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.25rem,2cqi,0.45rem)] py-[clamp(0.05rem,1.5cqi,0.35rem)]">
        <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
        <div className="text-center text-[clamp(1.4rem,13cqi,2.9rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">
          {time}
        </div>
      </div>

      <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
    </ClockShell>
  );
}
'@

Write-Utf8File "$designs/index.ts" @'
export { AnalogClassicClock } from './AnalogClassicClock';
export { AnalogMinimalClock } from './AnalogMinimalClock';
export { AnalogOrbitClock } from './AnalogOrbitClock';
export { DigitalClock } from './DigitalClock';
export { ElegantClock } from './ElegantClock';
export { MinimalClock } from './MinimalClock';
'@

Write-Utf8File "$base/index.ts" @'
export { ClockWidget } from './ClockWidget';
export { CLOCK_STYLES } from './clockRegistry';
export type { ClockStyle } from './clockTypes';
'@

Write-Utf8File "apps/operator-console/src/views/dashboards/widgets/ClockWidget.tsx" @'
export { ClockWidget } from './clock';
export type { ClockStyle } from './clock';
'@

Write-Host "HomePilot clock responsive V4 applied." -ForegroundColor Green
Write-Host "Next: npm run build --workspace=apps/operator-console" -ForegroundColor Cyan
