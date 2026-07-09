import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';
import { formatWeather } from '../clockUtils';

export function ClockShell({
  children,
  className = '',
  tone = 'warm',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'warm' | 'neutral' | 'analog' | 'minimal';
}) {
  const background =
    tone === 'neutral'
      ? 'bg-[radial-gradient(circle_at_50%_32%,hsl(var(--foreground)/0.045),transparent_36%),linear-gradient(145deg,hsl(var(--card)/0.92),hsl(var(--background)/0.98))]'
      : tone === 'analog'
        ? 'bg-[radial-gradient(circle_at_30%_44%,hsl(var(--primary)/0.18),transparent_38%),radial-gradient(circle_at_78%_64%,hsl(var(--foreground)/0.04),transparent_34%),linear-gradient(145deg,hsl(var(--card)/0.90),hsl(var(--background)/0.98))]'
        : tone === 'minimal'
          ? 'bg-[radial-gradient(circle_at_50%_44%,hsl(var(--foreground)/0.04),transparent_40%),linear-gradient(145deg,hsl(var(--card)/0.90),hsl(var(--background)/0.98))]'
          : 'bg-[radial-gradient(circle_at_25%_26%,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_76%_74%,hsl(var(--foreground)/0.035),transparent_32%),linear-gradient(145deg,hsl(var(--card)/0.92),hsl(var(--background)/0.98))]';

  return (
    <div
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] border border-white/5 ${background} ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(120deg,transparent_0%,hsl(var(--foreground)/0.035)_48%,transparent_100%)] opacity-70" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[inherit] border border-white/5" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/5 blur-3xl" />
      {children}
    </div>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.75)] ${className}`} />;
}

export function ClockLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <AccentDot />
      <span className="min-w-0 truncate text-[clamp(0.55rem,1.3cqi,0.82rem)] font-black uppercase tracking-[0.42em] text-primary">
        {children}
      </span>
    </div>
  );
}

export function WeatherPill({
  weather,
  status,
  copy,
  mode = 'full',
  className = '',
}: {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  mode?: 'full' | 'compact' | 'temp';
  className?: string;
}) {
  const label = formatWeather(weather, status, copy, mode);

  return (
    <div className={`min-w-0 overflow-hidden rounded-full border border-border/55 bg-background/30 px-[clamp(0.62rem,1.45cqi,0.95rem)] py-[clamp(0.25rem,0.72cqi,0.38rem)] shadow-inner ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <AccentDot />
        <span className="min-w-0 truncate text-[clamp(0.49rem,1.2cqi,0.72rem)] font-black uppercase tracking-[0.12em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockProgress({
  value,
  label,
  compact = false,
}: {
  value: number;
  label?: string;
  compact?: boolean;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0">
      <div className={compact ? 'h-0.5 overflow-hidden rounded-full bg-border/35' : 'h-1 overflow-hidden rounded-full bg-border/45'}>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{
            width: `${safeValue}%`,
            boxShadow: '0 0 18px hsl(var(--primary)/0.45)',
          }}
        />
      </div>
      {label ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-[clamp(0.48rem,1.18cqi,0.66rem)] font-black uppercase tracking-[0.22em] text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">{safeValue}%</span>
        </div>
      ) : null}
    </div>
  );
}

export function TimeText({
  hours,
  minutes,
  seconds,
  period,
  blink,
  size = 'hero',
  align = 'center',
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  size?: 'hero' | 'large' | 'medium' | 'compact';
  align?: 'left' | 'center' | 'right';
}) {
  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  const textSize =
    size === 'hero'
      ? 'text-[clamp(4rem,17cqi,8.4rem)]'
      : size === 'large'
        ? 'text-[clamp(3.35rem,13.5cqi,6.7rem)]'
        : size === 'medium'
          ? 'text-[clamp(2.75rem,10.5cqi,5.5rem)]'
          : 'text-[clamp(2.35rem,8cqi,4.5rem)]';

  return (
    <div className={`flex min-w-0 items-end ${justify} font-black tabular-nums leading-none tracking-[-0.085em] text-foreground`}>
      <span className={textSize}>{hours}</span>
      <span
        className={`${textSize} mb-[0.02em] px-[0.025em] leading-none transition-opacity duration-300`}
        style={{ color: 'hsl(var(--primary))', opacity: blink ? 0.92 : 0.34 }}
      >
        :
      </span>
      <span className={textSize}>{minutes}</span>

      {(seconds || period) ? (
        <span className="mb-[0.20em] ml-2 flex shrink-0 flex-col items-start gap-0.5 text-primary">
          {seconds ? <span className="text-[clamp(0.54rem,1.6cqi,0.86rem)] font-black tracking-[0.08em]">{seconds}</span> : null}
          {period ? <span className="text-[clamp(0.44rem,1.2cqi,0.66rem)] font-black uppercase tracking-[0.24em]">{period}</span> : null}
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
  premium = false,
  className = '',
}: {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
  minimal?: boolean;
  premium?: boolean;
  className?: string;
}) {
  const marks = Array.from({ length: 60 });
  const radiusClass = premium
    ? 'h-[clamp(10rem,38cqi,17rem)] w-[clamp(10rem,38cqi,17rem)]'
    : 'h-[clamp(8.6rem,32cqi,14rem)] w-[clamp(8.6rem,32cqi,14rem)]';

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${radiusClass} overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`hpDialFace-${minimal ? 'minimal' : premium ? 'premium' : 'classic'}`} cx="50%" cy="42%" r="64%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.68" />
        </radialGradient>
        <filter id={`hpDialShadow-${minimal ? 'minimal' : premium ? 'premium' : 'classic'}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="13" floodColor="hsl(var(--background))" floodOpacity="0.42" />
        </filter>
      </defs>

      <circle cx="60" cy="60" r="54" fill={`url(#hpDialFace-${minimal ? 'minimal' : premium ? 'premium' : 'classic'})`} stroke="hsl(var(--border))" strokeOpacity="0.74" strokeWidth="1" filter={`url(#hpDialShadow-${minimal ? 'minimal' : premium ? 'premium' : 'classic'})`} />
      <circle cx="60" cy="60" r="46" fill="none" stroke="hsl(var(--primary))" strokeOpacity={premium ? '0.22' : '0.13'} strokeWidth="1" />

      {marks.map((_, index) => {
        const angle = (index * 6 * Math.PI) / 180;
        const isHour = index % 5 === 0;
        const inner = isHour ? 39.5 : 45.5;
        const outer = premium && isHour ? 51 : 50;
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
            stroke={isHour ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isHour ? '0.68' : '0.26'}
            strokeWidth={isHour ? '1.45' : '0.65'}
            strokeLinecap="round"
          />
        );
      })}

      {minimal ? (
        <>
          <text x="60" y="26" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">12</text>
          <text x="95" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">3</text>
          <text x="60" y="99" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">6</text>
          <text x="25" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">9</text>
        </>
      ) : null}

      <line x1="60" y1="60" x2="60" y2="36" stroke="hsl(var(--foreground))" strokeWidth={premium ? '3.4' : '3.1'} strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="25" stroke="hsl(var(--muted-foreground))" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${minuteAngle} 60 60)`} />
      <line x1="60" y1="66" x2="60" y2="23" stroke="hsl(var(--primary))" strokeWidth="1.55" strokeLinecap="round" transform={`rotate(${secondAngle} 60 60)`} />

      <circle cx="60" cy="60" r={premium ? '8.5' : '8'} fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}