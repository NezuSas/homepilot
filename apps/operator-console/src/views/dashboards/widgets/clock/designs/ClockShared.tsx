import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';
import { formatWeather } from '../clockUtils';

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
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_18%_14%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.96),hsl(var(--background)/0.86))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[inherit] border border-white/5" />
      <div className="relative z-10 h-full w-full min-w-0">{children}</div>
    </div>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)] ${className}`} />;
}

export function WeatherPill({ weather, status, copy, compact = false, className = '' }: WeatherPillProps) {
  const label = formatWeather(weather, status, copy, compact);

  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-full border border-border/55 bg-background/35 px-[clamp(0.5rem,1.8cqi,0.82rem)] py-[clamp(0.22rem,0.8cqi,0.34rem)] shadow-inner shadow-black/10 ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <AccentDot />
        <span className="min-w-0 truncate text-[clamp(0.46rem,1.45cqi,0.68rem)] font-black uppercase tracking-[0.12em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockProgress({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0">
      <div className="h-1 overflow-hidden rounded-full bg-border/45">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${safeValue}%`, boxShadow: '0 0 14px hsl(var(--primary)/0.45)' }}
        />
      </div>
      {label ? (
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 text-[clamp(0.5rem,1.35cqi,0.66rem)] font-black uppercase tracking-[0.16em] text-muted-foreground">
          <span className="min-w-0 truncate">{label}</span>
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
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  compact?: boolean;
  align?: 'left' | 'center';
}) {
  const justify = align === 'left' ? 'justify-start' : 'justify-center';

  return (
    <div className={`flex min-w-0 items-end ${justify} font-black tabular-nums leading-none tracking-[-0.075em] text-foreground`}>
      <span className={compact ? 'text-[clamp(2.15rem,14cqi,5.05rem)]' : 'text-[clamp(2.8rem,17cqi,7.25rem)]'}>{hours}</span>
      <span
        className={compact ? 'mb-[0.06em] px-[0.035em] text-[clamp(1.9rem,12cqi,4.4rem)]' : 'mb-[0.06em] px-[0.035em] text-[clamp(2.3rem,14cqi,5.8rem)]'}
        style={{ color: 'hsl(var(--primary))', opacity: blink ? 1 : 0.36 }}
      >
        :
      </span>
      <span className={compact ? 'text-[clamp(2.15rem,14cqi,5.05rem)]' : 'text-[clamp(2.8rem,17cqi,7.25rem)]'}>{minutes}</span>
      {(seconds || period) ? (
        <span className="mb-[0.28em] ml-2 flex flex-col items-start gap-0.5 text-[clamp(0.48rem,1.8cqi,0.78rem)] font-black uppercase tracking-[0.14em] text-primary">
          {seconds ? <span>{seconds}</span> : null}
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
  variant = 'classic',
}: {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
  minimal?: boolean;
  variant?: 'classic' | 'orbit' | 'minimal';
}) {
  const resolvedVariant = minimal ? 'minimal' : variant;
  const marks = Array.from({ length: 12 });
  const showNumbers = resolvedVariant === 'minimal';
  const showOrbit = resolvedVariant === 'orbit';

  return (
    <svg viewBox="0 0 120 120" className="h-[clamp(5.8rem,28cqi,10rem)] w-[clamp(5.8rem,28cqi,10rem)] overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={`hpDial-${resolvedVariant}`} cx="50%" cy="46%" r="64%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.98" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.46" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#hpDial-${resolvedVariant})`} stroke="hsl(var(--border))" strokeOpacity="0.8" />
      <circle cx="60" cy="60" r="45" fill="none" stroke="hsl(var(--primary))" strokeOpacity={showOrbit ? '0.28' : '0.12'} />
      {marks.map((_, index) => {
        const angle = (index * 30 * Math.PI) / 180;
        const isQuarter = index % 3 === 0;
        const inner = isQuarter ? 40 : 44;
        const outer = 49;
        const x1 = 60 + Math.sin(angle) * inner;
        const y1 = 60 - Math.cos(angle) * inner;
        const x2 = 60 + Math.sin(angle) * outer;
        const y2 = 60 - Math.cos(angle) * outer;
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeOpacity={isQuarter ? 0.72 : 0.38} strokeWidth={isQuarter ? 1.8 : 1} strokeLinecap="round" />;
      })}
      {showNumbers ? (
        <>
          <text x="60" y="26" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">12</text>
          <text x="94" y="64" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">3</text>
          <text x="60" y="101" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">6</text>
          <text x="25" y="64" textAnchor="middle" className="fill-muted-foreground text-[9px] font-black">9</text>
        </>
      ) : null}
      {showOrbit ? <circle cx="60" cy="10" r="4.5" fill="hsl(var(--primary))" transform={`rotate(${secondAngle} 60 60)`} /> : null}
      <line x1="60" y1="60" x2="60" y2="36" stroke="hsl(var(--foreground))" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="24" stroke="hsl(var(--muted-foreground))" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${minuteAngle} 60 60)`} />
      <line x1="60" y1="64" x2="60" y2="22" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${secondAngle} 60 60)`} />
      <circle cx="60" cy="60" r="8.5" fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}