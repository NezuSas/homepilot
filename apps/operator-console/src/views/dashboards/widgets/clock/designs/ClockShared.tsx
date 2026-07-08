import type { ClockCopy, ClockWeather } from '../clockTypes';
import { getHandAngles } from '../clockUtils';

interface WeatherPillProps {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  compact?: boolean;
}

export function WeatherPill({ weather, status, copy, compact = false }: WeatherPillProps) {
  const label =
    weather && status === 'ready'
      ? compact
        ? `${weather.location} ${Math.round(weather.temperature)}°C`
        : `${weather.location} • ${weather.label} ${Math.round(weather.temperature)}°C`
      : status === 'error'
        ? copy.weatherUnavailable
        : copy.weatherLoading;

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-full border border-border/45 bg-background/35 px-[clamp(0.55rem,2cqi,0.85rem)] py-[clamp(0.22rem,0.9cqi,0.34rem)]">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
        <span className="min-w-0 truncate text-[clamp(0.48rem,1.55cqi,0.72rem)] font-black uppercase tracking-[0.14em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      {children}
    </div>
  );
}

export function ResponsiveTime({
  hours,
  minutes,
  seconds,
  period,
  blink,
  showSeconds = false,
  compact = false,
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  showSeconds?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-end justify-center font-black tabular-nums leading-none tracking-[-0.07em] text-foreground">
      <span className={compact ? 'text-[clamp(2.4rem,16cqi,5.2rem)]' : 'text-[clamp(3.1rem,18cqi,7.2rem)]'}>
        {hours}
      </span>
      <span
        className={compact ? 'mb-[0.06em] px-[0.03em] text-[clamp(2.1rem,14cqi,4.8rem)]' : 'mb-[0.06em] px-[0.03em] text-[clamp(2.6rem,15cqi,6rem)]'}
        style={{ color: 'hsl(var(--primary))', opacity: blink ? 1 : 0.35 }}
      >
        :
      </span>
      <span className={compact ? 'text-[clamp(2.4rem,16cqi,5.2rem)]' : 'text-[clamp(3.1rem,18cqi,7.2rem)]'}>
        {minutes}
      </span>

      {showSeconds && seconds ? (
        <span className="mb-[0.18em] ml-1.5 text-[clamp(0.65rem,3cqi,1.15rem)] font-black tracking-normal text-primary">
          {seconds}
        </span>
      ) : null}

      {!showSeconds && period ? (
        <span className="mb-[0.28em] ml-2 text-[clamp(0.48rem,1.8cqi,0.8rem)] font-black uppercase tracking-[0.18em] text-primary">
          {period}
        </span>
      ) : null}
    </div>
  );
}

export function ClockProgress({
  label,
  value,
}: {
  label?: string;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <div className="h-1 overflow-hidden rounded-full bg-border/45">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            boxShadow: '0 0 14px hsl(var(--primary)/0.45)',
          }}
        />
      </div>

      {label ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-[clamp(0.5rem,1.5cqi,0.68rem)] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">{value}%</span>
        </div>
      ) : null}
    </div>
  );
}

export function AnalogDial({
  now,
  hourAngle,
  minuteAngle,
  secondAngle,
  variant = 'classic',
  minimal = false,
}: {
  now?: Date;
  hourAngle?: number;
  minuteAngle?: number;
  secondAngle?: number;
  variant?: 'classic' | 'orbit' | 'minimal';
  minimal?: boolean;
}) {
  const computedAngles = now ? getHandAngles(now) : null;
  const angles = {
    hour: hourAngle ?? computedAngles?.hour ?? 0,
    minute: minuteAngle ?? computedAngles?.minute ?? 0,
    second: secondAngle ?? computedAngles?.second ?? 0,
  };

  const resolvedVariant = minimal ? 'minimal' : variant;
  const showOrbit = resolvedVariant === 'orbit';
  const showNumbers = resolvedVariant === 'minimal';

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-[clamp(5.2rem,30cqi,9.5rem)] w-[clamp(5.2rem,30cqi,9.5rem)] overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`clockDial-${variant}`} cx="50%" cy="45%" r="62%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      <circle
        cx="60"
        cy="60"
        r="53"
        fill={`url(#clockDial-${variant})`}
        stroke="hsl(var(--border))"
        strokeOpacity="0.75"
        strokeWidth="1"
      />

      <circle
        cx="60"
        cy="60"
        r="43"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeOpacity={showOrbit ? '0.26' : '0.12'}
        strokeWidth="1"
      />

      {Array.from({ length: 12 }).map((_, index) => {
        const angle = index * 30;
        const isQuarter = index % 3 === 0;
        return (
          <line
            key={index}
            x1="60"
            y1={isQuarter ? '10' : '14'}
            x2="60"
            y2={isQuarter ? '18' : '19'}
            stroke={isQuarter ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isQuarter ? '0.65' : '0.55'}
            strokeWidth={isQuarter ? '1.5' : '1'}
            strokeLinecap="round"
            transform={`rotate(${angle} 60 60)`}
          />
        );
      })}

      {showNumbers ? (
        <>
          <text x="60" y="25" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">12</text>
          <text x="94" y="64" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">3</text>
          <text x="60" y="101" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">6</text>
          <text x="25" y="64" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">9</text>
        </>
      ) : null}

      {showOrbit ? (
        <circle
          cx="60"
          cy="10"
          r="4"
          fill="hsl(var(--primary))"
          transform={`rotate(${angles.second} 60 60)`}
          opacity="0.95"
        />
      ) : null}

      <line
        x1="60"
        y1="60"
        x2="60"
        y2="34"
        stroke="hsl(var(--foreground))"
        strokeWidth="3.4"
        strokeLinecap="round"
        transform={`rotate(${angles.hour} 60 60)`}
      />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="24"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2.2"
        strokeLinecap="round"
        transform={`rotate(${angles.minute} 60 60)`}
      />
      <line
        x1="60"
        y1="64"
        x2="60"
        y2="24"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${angles.second} 60 60)`}
      />

      <circle cx="60" cy="60" r="8" fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}