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
      ? `${weather!.location} ${Math.round(weather!.temperature)}Â°C`
      : `${weather!.location} â€¢ ${Math.round(weather!.temperature)}Â°C â€¢ ${weather!.label}`
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