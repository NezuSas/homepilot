$ErrorActionPreference = "Stop"

function Write-Utf8File {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Set-Content -Path $Path -Value $Content -Encoding utf8 -NoNewline
}

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/ClockWidget.tsx" -Content @'
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../../types';
import { CLOCK_DESIGN_COMPONENTS } from './clockRegistry';
import type { ClockStyle } from './clockTypes';
import { getClockCopy, getClockLocale, normalizeLocale } from './clockUtils';
import { useCuencaWeather } from './useCuencaWeather';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  const locale = useMemo(() => {
    return normalizeLocale(i18n.language || getClockLocale());
  }, [i18n.language]);

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

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/clockRegistry.ts" -Content @'
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

export const CLOCK_MIN_LAYOUT = { w: 4, h: 4 } as const;

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'minimal',
    label: 'Digital minimal',
    labelEs: 'Digital minimal',
    labelEn: 'Digital minimal',
    minW: 4,
    minH: 4,
  },
  {
    value: 'digital',
    label: 'Digital hogar',
    labelEs: 'Digital hogar',
    labelEn: 'Digital home',
    minW: 4,
    minH: 4,
  },
  {
    value: 'elegant',
    label: 'Digital elegante',
    labelEs: 'Digital elegante',
    labelEn: 'Elegant digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-classic',
    label: 'Analógico clásico',
    labelEs: 'Analógico clásico',
    labelEn: 'Classic analog',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-orbit',
    label: 'Analógico órbita',
    labelEs: 'Analógico órbita',
    labelEn: 'Orbit analog',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-minimal',
    label: 'Analógico minimal',
    labelEs: 'Analógico minimal',
    labelEn: 'Minimal analog',
    minW: 4,
    minH: 4,
  },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
  'analog-classic': AnalogClassicClock,
  'analog-orbit': AnalogOrbitClock,
  'analog-minimal': AnalogMinimalClock,
};

export function getClockStyleLabel(style: ClockStyleOption, locale?: string): string {
  return locale?.toLowerCase().startsWith('en') ? style.labelEn : style.labelEs;
}

export function getClockMinimumLayout(style?: ClockStyle): { w: number; h: number } {
  const selected = CLOCK_STYLES.find((item) => item.value === style);
  return { w: selected?.minW ?? CLOCK_MIN_LAYOUT.w, h: selected?.minH ?? CLOCK_MIN_LAYOUT.h };
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/useCuencaWeather.ts" -Content @'
import { useEffect, useMemo, useState } from 'react';
import type { ClockWeather } from './clockTypes';
import { getWeatherDescription, normalizeLocale } from './clockUtils';

const CUENCA_LATITUDE = -2.9006;
const CUENCA_LONGITUDE = -79.0045;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

type WeatherCacheEntry = {
  weather: ClockWeather;
  cachedAt: number;
};

const weatherCache = new Map<string, WeatherCacheEntry>();
const inflightByLocale = new Map<string, Promise<ClockWeather>>();

async function fetchCuencaWeather(localeInput: string): Promise<ClockWeather> {
  const locale = normalizeLocale(localeInput || 'es-EC');
  const now = Date.now();
  const cached = weatherCache.get(locale);

  if (cached && now - cached.cachedAt < WEATHER_CACHE_MS) {
    return cached.weather;
  }

  const inflight = inflightByLocale.get(locale);
  if (inflight) return inflight;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(CUENCA_LATITUDE));
  url.searchParams.set('longitude', String(CUENCA_LONGITUDE));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'America/Guayaquil');

  const request = fetch(url.toString(), { cache: 'no-store' })
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

      weatherCache.set(locale, { weather, cachedAt: Date.now() });
      return weather;
    })
    .finally(() => {
      inflightByLocale.delete(locale);
    });

  inflightByLocale.set(locale, request);
  return request;
}

export function useCuencaWeather(localeInput: string) {
  const locale = useMemo(() => normalizeLocale(localeInput || 'es-EC'), [localeInput]);
  const cached = weatherCache.get(locale)?.weather ?? null;

  const [weather, setWeather] = useState<ClockWeather | null>(cached);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(cached ? 'ready' : 'idle');

  useEffect(() => {
    let cancelled = false;

    const loadWeather = () => {
      const currentCached = weatherCache.get(locale)?.weather ?? null;
      if (currentCached) setWeather(currentCached);
      setStatus(currentCached ? 'ready' : 'loading');

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

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/ClockShared.tsx" -Content @'
import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';
import { getHandAngles } from '../clockUtils';

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
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] text-foreground ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.98),hsl(var(--background)/0.78))]" />
      <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
      <div className="relative z-10 h-full w-full min-w-0">{children}</div>
    </div>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.75)] ${className}`} />;
}

export function ClockLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 text-[clamp(0.5rem,1.45cqi,0.7rem)] font-black uppercase tracking-[0.32em] text-primary ${className}`}>
      <AccentDot />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export function WeatherPill({ weather, status, copy, compact = false, className = '' }: WeatherPillProps) {
  const isReady = Boolean(weather && status === 'ready');
  const label = isReady
    ? compact
      ? `${weather!.location} ${Math.round(weather!.temperature)}°C`
      : `${weather!.location} • ${Math.round(weather!.temperature)}°C • ${weather!.label}`
    : status === 'error'
      ? copy.weatherUnavailable
      : copy.weatherLoading;

  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-full border border-border/50 bg-background/35 px-[clamp(0.55rem,2cqi,0.85rem)] py-[clamp(0.22rem,0.9cqi,0.36rem)] shadow-inner ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <AccentDot />
        <span className="min-w-0 truncate text-[clamp(0.48rem,1.45cqi,0.68rem)] font-black uppercase tracking-[0.13em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockProgress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="min-w-0">
      <div className="h-1 overflow-hidden rounded-full bg-border/45">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, boxShadow: '0 0 16px hsl(var(--primary)/0.42)' }}
        />
      </div>
      {label ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-[clamp(0.48rem,1.35cqi,0.66rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">{value}%</span>
        </div>
      ) : null}
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
  const size = compact ? 'text-[clamp(2.6rem,17cqi,5.4rem)]' : 'text-[clamp(3.4rem,19cqi,7.6rem)]';
  const colonSize = compact ? 'text-[clamp(2.2rem,14cqi,4.8rem)]' : 'text-[clamp(2.8rem,16cqi,6.2rem)]';

  return (
    <div className="flex min-w-0 items-end justify-center font-black tabular-nums leading-none tracking-[-0.075em] text-foreground">
      <span className={size}>{hours}</span>
      <span className={`${colonSize} mb-[0.07em] px-[0.035em] text-primary transition-opacity duration-300`} style={{ opacity: blink ? 1 : 0.35 }}>
        :
      </span>
      <span className={size}>{minutes}</span>
      {(seconds || period) ? (
        <span className="mb-[0.22em] ml-2 flex flex-col items-start gap-0.5 text-[clamp(0.52rem,1.8cqi,0.82rem)] font-black uppercase tracking-[0.16em] text-primary">
          {seconds ? <span className="tabular-nums">{seconds}</span> : null}
          {period ? <span>{period}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function AnalogDial({
  now,
  hourAngle,
  minuteAngle,
  secondAngle,
  minimal = false,
  orbit = false,
  className = '',
}: {
  now?: Date;
  hourAngle?: number;
  minuteAngle?: number;
  secondAngle?: number;
  minimal?: boolean;
  orbit?: boolean;
  className?: string;
}) {
  const computedAngles = now ? getHandAngles(now) : null;
  const angles = {
    hour: hourAngle ?? computedAngles?.hour ?? 0,
    minute: minuteAngle ?? computedAngles?.minute ?? 0,
    second: secondAngle ?? computedAngles?.second ?? 0,
  };

  const marks = Array.from({ length: 12 });

  return (
    <svg
      viewBox="0 0 120 120"
      className={`h-[clamp(6rem,34cqi,11rem)] w-[clamp(6rem,34cqi,11rem)] overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hp-clock-dial" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.98" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.7" />
        </radialGradient>
        <filter id="hp-clock-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="black" floodOpacity="0.22" />
        </filter>
      </defs>

      <circle cx="60" cy="60" r="55" fill="url(#hp-clock-dial)" stroke="hsl(var(--border))" strokeOpacity="0.75" filter="url(#hp-clock-soft-shadow)" />
      <circle cx="60" cy="60" r="43" fill="none" stroke="hsl(var(--primary))" strokeOpacity={orbit ? '0.28' : '0.12'} strokeWidth="1.2" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.35" strokeWidth="0.8" />

      {marks.map((_, index) => {
        const angle = (index * 30 * Math.PI) / 180;
        const isQuarter = index % 3 === 0;
        const inner = isQuarter ? 42 : 46;
        const outer = 50;
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
            stroke={isQuarter ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isQuarter ? '0.7' : '0.48'}
            strokeWidth={isQuarter ? '1.7' : '1'}
            strokeLinecap="round"
          />
        );
      })}

      {minimal ? (
        <>
          <text x="60" y="25" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">12</text>
          <text x="94" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">3</text>
          <text x="60" y="101" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">6</text>
          <text x="26" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">9</text>
        </>
      ) : null}

      {orbit ? (
        <circle cx="60" cy="10" r="4.2" fill="hsl(var(--primary))" transform={`rotate(${angles.second} 60 60)`} />
      ) : null}

      <line x1="60" y1="60" x2="60" y2="37" stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" transform={`rotate(${angles.hour} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="25" stroke="hsl(var(--muted-foreground))" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${angles.minute} 60 60)`} />
      <line x1="60" y1="66" x2="60" y2="23" stroke="hsl(var(--primary))" strokeWidth="1.55" strokeLinecap="round" transform={`rotate(${angles.second} 60 60)`} />
      <circle cx="60" cy="60" r="8.2" fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/MinimalClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const dayProgress = getDayProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.localTime}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[clamp(0.5rem,1.3cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-[clamp(0.4rem,2cqi,1rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </div>

        <div className="grid min-w-0 gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <ClockProgress label={copy.dayProgress} value={dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/DigitalClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

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
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.digitalPro}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="grid h-[clamp(2.4rem,9cqi,3.5rem)] w-[clamp(2.4rem,9cqi,3.5rem)] place-items-center rounded-full border border-border/50 bg-background/35 text-center shadow-inner">
            <div className="leading-none">
              <div className="text-[clamp(0.8rem,2.7cqi,1.2rem)] font-black tabular-nums">{seconds}</div>
              <div className="mt-0.5 text-[clamp(0.42rem,1.1cqi,0.55rem)] font-black uppercase tracking-[0.15em] text-primary">{copy.secondsShort}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[min(82%,28rem)] items-center justify-center rounded-[2rem] border border-border/50 bg-background/35 px-[clamp(0.8rem,3cqi,1.6rem)] py-[clamp(0.6rem,2.8cqi,1.2rem)] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_20px_60px_rgb(0_0_0/0.18)]">
          <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="flex-1" />
            <span className="shrink-0 text-[clamp(0.5rem,1.35cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-primary">{copy.sync} {progress}%</span>
          </div>
          <ClockProgress value={progress} />
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/ElegantClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, ResponsiveTime, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const weekday = formatWeekday(now, locale, 'long');
  const month = formatMonth(now, locale, 'short').replace('.', '');
  const day = now.getDate();
  const year = now.getFullYear();
  const dayProgress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(0.9rem,3cqi,1.55rem)]">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockLabel>{label}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{weekday}</div>
          </div>
          <div className="grid min-h-[clamp(2.7rem,10cqi,4rem)] min-w-[clamp(2.7rem,10cqi,4rem)] place-items-center rounded-2xl border border-primary/25 bg-primary/10 px-2 text-center text-primary shadow-inner">
            <div className="leading-none">
              <div className="text-[clamp(0.48rem,1.2cqi,0.62rem)] font-black uppercase tracking-[0.18em]">{month}</div>
              <div className="mt-1 text-[clamp(1.05rem,3.5cqi,1.65rem)] font-black tabular-nums">{day}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-[clamp(0.3rem,2cqi,0.8rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} compact />
          <div className="text-[clamp(0.48rem,1.25cqi,0.64rem)] font-black uppercase tracking-[0.24em] text-muted-foreground">{year}</div>
        </div>

        <div className="grid min-w-0 gap-3">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
          <ClockProgress label={copy.dayProgress} value={dayProgress} />
        </div>
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogClassicClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-w-0 grid-rows-[1fr_auto] gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="grid min-h-0 min-w-0 items-center gap-[clamp(0.7rem,3cqi,1.4rem)] @[28rem]:grid-cols-[0.95fr_1fr]">
          <div className="flex min-w-0 justify-center @[28rem]:justify-end">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
          </div>
          <div className="min-w-0 text-center @[28rem]:text-left">
            <ClockLabel className="justify-center @[28rem]:justify-start">{copy.analogClassic}</ClockLabel>
            <div className="mt-2 text-[clamp(0.62rem,1.6cqi,0.86rem)] font-semibold text-muted-foreground">{weekday}</div>
            <div className="mt-[clamp(0.6rem,2.5cqi,1.2rem)] text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.07em]">{time}</div>
          </div>
        </div>
        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogOrbitClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockProgress, ClockShell, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.analogOrbit}</ClockLabel>
            <div className="mt-2 truncate text-[clamp(0.58rem,1.45cqi,0.8rem)] font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <span className="shrink-0 text-[clamp(0.58rem,1.4cqi,0.74rem)] font-black tabular-nums tracking-[0.16em] text-primary">{progress}%</span>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 items-center gap-[clamp(0.6rem,3cqi,1.2rem)] @[28rem]:grid-cols-[1fr_0.9fr]">
          <div className="flex justify-center @[28rem]:justify-end">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} orbit />
          </div>
          <div className="min-w-0 text-center @[28rem]:text-left">
            <div className="text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.07em]">{time}</div>
            <div className="mt-3"><WeatherPill weather={weather} status={weatherStatus} copy={copy} compact /></div>
          </div>
        </div>

        <ClockProgress value={progress} />
      </div>
    </ClockShell>
  );
}
'@

Write-Utf8File -Path "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogMinimalClock.tsx" -Content @'
import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockLabel, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const date = formatCompactDate(now, locale);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="flex h-full min-w-0 flex-col justify-between gap-3 p-[clamp(0.9rem,3cqi,1.5rem)]">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <ClockLabel>{copy.analogMinimal}</ClockLabel>
          <div className="shrink-0 rounded-full border border-border/50 bg-background/35 px-3 py-1 text-[clamp(0.48rem,1.25cqi,0.62rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">{date}</div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.45rem,2cqi,1rem)]">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
          <div className="text-[clamp(2rem,10cqi,4rem)] font-black tabular-nums tracking-[-0.08em]">{time}</div>
        </div>

        <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
      </div>
    </ClockShell>
  );
}
'@

Write-Host "HomePilot clock V6 premium applied. Run: npm run build --workspace=apps/operator-console"
