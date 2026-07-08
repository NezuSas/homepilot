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