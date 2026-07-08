$ErrorActionPreference = "Stop"

function Write-Utf8NoBom($Path, $Content) {
  $Dir = Split-Path -Parent $Path
  if (-not (Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

# ClockShared.tsx — shared responsive primitives, ASCII-safe strings using unicode escapes in TS
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/ClockShared.tsx" @'
import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';

interface WeatherPillProps {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  compact?: boolean;
  className?: string;
  tone?: 'quiet' | 'solid';
}

export function ClockShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] text-foreground ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.14),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background)/0.84))]" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),inset_0_0_0_1px_hsl(var(--border)/0.45)]" />
      <div className="relative z-10 h-full w-full min-w-0">{children}</div>
    </div>
  );
}

export function ClockKicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 text-[clamp(0.52rem,1.4cqi,0.72rem)] font-black uppercase tracking-[0.36em] text-primary ${className}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.75)]" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export function SmallMeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 truncate text-[clamp(0.58rem,1.5cqi,0.78rem)] font-semibold text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

export function WeatherPill({ weather, status, copy, compact = false, className = '', tone = 'quiet' }: WeatherPillProps) {
  const isReady = Boolean(weather && status === 'ready');
  const temperature = isReady ? `${Math.round(weather!.temperature)}\u00b0C` : '';
  const label = isReady
    ? compact
      ? `${weather!.location} ${temperature}`
      : `${weather!.location} \u2022 ${weather!.label} \u2022 ${temperature}`
    : status === 'error'
      ? copy.weatherUnavailable
      : copy.weatherLoading;

  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-full border px-[clamp(0.55rem,1.6cqi,0.9rem)] py-[clamp(0.24rem,0.75cqi,0.4rem)] ${
        tone === 'solid'
          ? 'border-primary/25 bg-primary/10'
          : 'border-border/50 bg-background/35'
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
        <span className="min-w-0 truncate text-[clamp(0.5rem,1.28cqi,0.7rem)] font-black uppercase tracking-[0.12em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function LinearProgress({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="h-[clamp(0.16rem,0.7cqi,0.28rem)] overflow-hidden rounded-full bg-border/45">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${safeValue}%`, boxShadow: '0 0 14px hsl(var(--primary)/0.45)' }}
        />
      </div>
      {label ? (
        <div className="mt-[clamp(0.35rem,1cqi,0.65rem)] flex items-center justify-between gap-3 text-[clamp(0.48rem,1.18cqi,0.66rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">{safeValue}%</span>
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
  align = 'center',
  className = '',
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  compact?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  const mainSize = compact ? 'text-[clamp(2.15rem,14cqi,5rem)]' : 'text-[clamp(3rem,17cqi,7.6rem)]';
  const colonSize = compact ? 'text-[clamp(1.9rem,12cqi,4.4rem)]' : 'text-[clamp(2.55rem,14cqi,6.1rem)]';

  return (
    <div className={`flex min-w-0 items-end ${justify} font-black tabular-nums leading-none tracking-[-0.075em] text-foreground ${className}`}>
      <span className={mainSize}>{hours}</span>
      <span className={`${colonSize} mb-[0.06em] px-[0.035em] transition-opacity duration-300`} style={{ color: 'hsl(var(--primary))', opacity: blink ? 1 : 0.35 }}>
        :
      </span>
      <span className={mainSize}>{minutes}</span>
      {(seconds || period) ? (
        <span className="mb-[0.24em] ml-2 flex flex-col items-start gap-0.5 text-[clamp(0.48rem,1.65cqi,0.82rem)] font-black uppercase tracking-[0.16em] text-primary">
          {seconds ? <span className="tabular-nums">{seconds}</span> : null}
          {period ? <span>{period}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function AnalogDial({
  hourAngle,
  minuteAngle,
  secondAngle,
  minimal = false,
  orbit = false,
  className = '',
}: {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
  minimal?: boolean;
  orbit?: boolean;
  className?: string;
}) {
  const marks = Array.from({ length: 60 });

  return (
    <svg
      viewBox="0 0 140 140"
      className={`h-[clamp(6.4rem,32cqi,12rem)] w-[clamp(6.4rem,32cqi,12rem)] overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hpClockDial" cx="50%" cy="42%" r="64%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.98" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.54" />
        </radialGradient>
      </defs>
      <circle cx="70" cy="70" r="62" fill="url(#hpClockDial)" stroke="hsl(var(--border))" strokeOpacity="0.8" />
      <circle cx="70" cy="70" r="49" fill="none" stroke="hsl(var(--primary))" strokeOpacity={orbit ? 0.32 : 0.13} />
      {marks.map((_, index) => {
        const angle = (index * 6 * Math.PI) / 180;
        const isHour = index % 5 === 0;
        const inner = isHour ? 50 : 55;
        const outer = 59;
        const x1 = 70 + Math.sin(angle) * inner;
        const y1 = 70 - Math.cos(angle) * inner;
        const x2 = 70 + Math.sin(angle) * outer;
        const y2 = 70 - Math.cos(angle) * outer;
        if (!isHour && minimal) return null;
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isHour ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isHour ? 0.72 : 0.42}
            strokeWidth={isHour ? 1.6 : 0.8}
            strokeLinecap="round"
          />
        );
      })}
      {minimal ? (
        <>
          <text x="70" y="31" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">12</text>
          <text x="109" y="74" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">3</text>
          <text x="70" y="116" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">6</text>
          <text x="31" y="74" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">9</text>
        </>
      ) : null}
      {orbit ? (
        <circle cx="70" cy="11" r="5" fill="hsl(var(--primary))" transform={`rotate(${secondAngle} 70 70)`} />
      ) : null}
      <line x1="70" y1="70" x2="70" y2="42" stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" transform={`rotate(${hourAngle} 70 70)`} />
      <line x1="70" y1="70" x2="70" y2="30" stroke="hsl(var(--muted-foreground))" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${minuteAngle} 70 70)`} />
      <line x1="70" y1="76" x2="70" y2="27" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${secondAngle} 70 70)`} />
      <circle cx="70" cy="70" r="9" fill="hsl(var(--primary))" />
      <circle cx="70" cy="70" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}

export function HeroWeatherRow({ weather, status, copy }: WeatherPillProps) {
  return <WeatherPill weather={weather} status={status} copy={copy} className="w-full" />;
}
'@

# MinimalClock.tsx — Digital Residencial
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/MinimalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getDayProgress, pad } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function MinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const progress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.75rem,2.5cqi,1.25rem)] p-[clamp(1rem,3.2cqi,1.6rem)]">
        <header className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.localTime}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[clamp(0.52rem,1.2cqi,0.7rem)] font-black uppercase tracking-[0.14em] text-primary">
            {seconds} {copy.secondsShort}
          </div>
        </header>

        <main className="flex min-h-0 items-center justify-center">
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} />
        </main>

        <footer className="min-w-0 space-y-[clamp(0.45rem,1.2cqi,0.75rem)]">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
          <LinearProgress value={progress} label={copy.dayProgress} />
        </footer>
      </div>
    </ClockShell>
  );
}
'@

# DigitalClock.tsx — Digital Compacto capsule
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/DigitalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.7rem,2cqi,1.15rem)] p-[clamp(0.95rem,2.7cqi,1.45rem)]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.digitalPro}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="grid h-[clamp(2.4rem,7.5cqi,3.4rem)] w-[clamp(2.4rem,7.5cqi,3.4rem)] shrink-0 place-items-center rounded-full border border-border/60 bg-background/45 text-center text-[clamp(0.52rem,1.2cqi,0.68rem)] font-black uppercase leading-tight text-primary">
            <span>{seconds}</span>
            <span className="-mt-1 text-[0.68em]">{copy.secondsShort}</span>
          </div>
        </header>

        <main className="flex min-h-0 items-center justify-center">
          <div className="rounded-[clamp(1.35rem,4cqi,2.2rem)] border border-border/55 bg-background/38 px-[clamp(1rem,4cqi,2.8rem)] py-[clamp(0.75rem,2.5cqi,1.35rem)] shadow-[0_18px_50px_hsl(var(--background)/0.35)]">
            <ResponsiveTime hours={hours} minutes={minutes} period={period} blink={blink} compact />
          </div>
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-[clamp(0.7rem,2cqi,1rem)] max-[420px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <div className="min-w-[clamp(4.8rem,15cqi,7rem)]">
            <LinearProgress value={progress} label={copy.sync} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}
'@

# ElegantClock.tsx — Editorial
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/ElegantClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, formatWeekday, getDayProgress, pad } from '../clockUtils';
import { ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function ElegantClock({ now, locale, config, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const blink = now.getSeconds() % 2 === 0;
  const label = config.appearance?.title || copy.homeTime;
  const compactDate = formatCompactDate(now, locale).split(' ');
  const progress = getDayProgress(now);

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.7rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{label}</ClockKicker>
            <SmallMeta className="mt-2">{formatWeekday(now, locale, 'long')}</SmallMeta>
          </div>
          <div className="grid min-h-[clamp(2.6rem,8cqi,4rem)] min-w-[clamp(2.6rem,8cqi,4rem)] shrink-0 place-items-center rounded-[1.2rem] border border-primary/25 bg-primary/10 px-2 text-center text-primary">
            <span className="text-[clamp(0.48rem,1.2cqi,0.65rem)] font-black uppercase tracking-[0.18em]">{compactDate[1] ?? compactDate[0]}</span>
            <span className="text-[clamp(1rem,3.2cqi,1.6rem)] font-black leading-none">{compactDate[0]}</span>
          </div>
        </header>

        <main className="flex min-h-0 items-end justify-start pb-[clamp(0.25rem,1.2cqi,0.75rem)]">
          <ResponsiveTime hours={hours} minutes={minutes} seconds={seconds} blink={blink} align="left" />
        </main>

        <footer className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-[clamp(0.65rem,2cqi,1rem)] max-[420px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <div className="min-w-[clamp(5rem,16cqi,7rem)]">
            <LinearProgress value={progress} label={copy.residentialEdge} />
          </div>
        </footer>
      </div>
    </ClockShell>
  );
}
'@

# AnalogClassicClock.tsx — Analog Premium
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogClassicClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, SmallMeta, WeatherPill } from './ClockShared';

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-cols-[minmax(7rem,0.9fr)_1fr] items-center gap-[clamp(0.8rem,3cqi,1.7rem)] p-[clamp(1rem,3cqi,1.6rem)] max-[460px]:grid-cols-1 max-[460px]:place-items-center">
        <div className="flex min-w-0 items-center justify-center">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-[clamp(0.45rem,1.4cqi,0.85rem)] max-[460px]:w-full max-[460px]:items-center">
          <ClockKicker>{copy.analogClassic}</ClockKicker>
          <SmallMeta>{formatWeekday(now, locale, 'short')}</SmallMeta>
          <div className="text-[clamp(2rem,9cqi,4.4rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" tone="solid" />
        </div>
      </div>
    </ClockShell>
  );
}
'@

# AnalogOrbitClock.tsx — Orbit with circular progress identity
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogOrbitClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, LinearProgress, ResponsiveTime, SmallMeta, WeatherPill } from './ClockShared';

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const blink = now.getSeconds() % 2 === 0;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.6rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <ClockKicker>{copy.analogOrbit}</ClockKicker>
            <SmallMeta className="mt-2">{formatDateLine(now, locale)}</SmallMeta>
          </div>
          <div className="shrink-0 text-[clamp(0.6rem,1.5cqi,0.78rem)] font-black tabular-nums text-primary">{progress}%</div>
        </header>

        <main className="grid min-h-0 grid-cols-[1fr_1fr] items-center gap-[clamp(0.5rem,2cqi,1.2rem)] max-[460px]:grid-cols-1">
          <div className="flex justify-center">
            <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} orbit />
          </div>
          <ResponsiveTime hours={hours} minutes={minutes} blink={blink} compact align="right" className="max-[460px]:justify-center" />
        </main>

        <footer className="min-w-0 space-y-[clamp(0.4rem,1.2cqi,0.7rem)]">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
          <LinearProgress value={progress} />
        </footer>
      </div>
    </ClockShell>
  );
}
'@

# AnalogMinimalClock.tsx — clean clock
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/clock/designs/AnalogMinimalClock.tsx" @'
import type { ClockDesignProps } from '../clockTypes';
import { formatCompactDate, getHandAngles, pad } from '../clockUtils';
import { AnalogDial, ClockKicker, ClockShell, WeatherPill } from './ClockShared';

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-[clamp(0.55rem,2cqi,1rem)] p-[clamp(1rem,3cqi,1.55rem)]">
        <header className="flex items-start justify-between gap-3">
          <ClockKicker>{copy.analogMinimal}</ClockKicker>
          <div className="shrink-0 rounded-full border border-border/50 bg-background/35 px-3 py-1 text-[clamp(0.5rem,1.25cqi,0.68rem)] font-black uppercase tracking-[0.14em] text-muted-foreground">
            {formatCompactDate(now, locale)}
          </div>
        </header>
        <main className="flex min-h-0 flex-col items-center justify-center gap-[clamp(0.45rem,1.5cqi,0.8rem)]">
          <AnalogDial hourAngle={angles.hour} minuteAngle={angles.minute} secondAngle={angles.second} minimal />
          <div className="text-[clamp(2rem,8cqi,4.6rem)] font-black leading-none tracking-[-0.08em] text-foreground tabular-nums">{time}</div>
        </main>
        <footer className="min-w-0">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact className="w-full" />
        </footer>
      </div>
    </ClockShell>
  );
}
'@

Write-Host "HomePilot Clock V8 premium files written. Run: npm run build --workspace=apps/operator-console"
