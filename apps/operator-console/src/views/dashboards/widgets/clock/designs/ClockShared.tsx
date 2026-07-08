import type { ReactNode } from 'react';
import type { ClockCopy, ClockWeather } from '../clockTypes';
import { formatWeather } from '../clockUtils';

interface WeatherPillProps {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  mode?: 'full' | 'compact' | 'temp';
  className?: string;
}

export function ClockShell({
  children,
  className = '',
  variant = 'standard',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'standard' | 'quiet' | 'analog';
}) {
  const surface =
    variant === 'quiet'
      ? 'bg-[radial-gradient(circle_at_35%_20%,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.80),hsl(var(--background)/0.96))]'
      : variant === 'analog'
        ? 'bg-[radial-gradient(circle_at_25%_28%,hsl(var(--primary)/0.14),transparent_36%),linear-gradient(135deg,hsl(var(--card)/0.84),hsl(var(--background)/0.96))]'
        : 'bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(145deg,hsl(var(--card)/0.86),hsl(var(--background)/0.96))]';

  return (
    <div
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] border border-white/5 ${surface} ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.025),transparent)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[inherit] border border-white/5" />
      {children}
    </div>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.75)] ${className}`} />;
}

export function ClockLabel({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const justify = align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : 'justify-start text-left';

  return (
    <div className={`flex min-w-0 items-center gap-2 ${justify} ${className}`}>
      <AccentDot />
      <span className="min-w-0 truncate text-[clamp(0.54rem,1.45cqi,0.82rem)] font-black uppercase tracking-[0.42em] text-primary">
        {children}
      </span>
    </div>
  );
}

export function WeatherPill({ weather, status, copy, mode = 'full', className = '' }: WeatherPillProps) {
  const label = formatWeather(weather, status, copy, mode);

  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-full border border-border/55 bg-background/28 px-[clamp(0.55rem,1.7cqi,0.9rem)] py-[clamp(0.22rem,0.75cqi,0.36rem)] shadow-inner ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <AccentDot className="h-1.25 w-1.25" />
        <span className="min-w-0 truncate text-[clamp(0.48rem,1.35cqi,0.72rem)] font-black uppercase tracking-[0.12em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockProgress({
  value,
  label,
  mode = 'line',
}: {
  value: number;
  label?: string;
  mode?: 'line' | 'minimal';
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0">
      <div className={mode === 'minimal' ? 'h-0.5 overflow-hidden rounded-full bg-border/35' : 'h-1 overflow-hidden rounded-full bg-border/45'}>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{
            width: `${safeValue}%`,
            boxShadow: '0 0 18px hsl(var(--primary)/0.45)',
          }}
        />
      </div>
      {label ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-[clamp(0.48rem,1.25cqi,0.66rem)] font-black uppercase tracking-[0.22em] text-muted-foreground">
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
  scale = 'hero',
}: {
  hours: string;
  minutes: string;
  seconds?: string;
  period?: string;
  blink: boolean;
  compact?: boolean;
  align?: 'left' | 'center' | 'right';
  scale?: 'hero' | 'medium' | 'small';
}) {
  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  const size =
    scale === 'small'
      ? 'text-[clamp(2.2rem,11cqi,4.8rem)]'
      : scale === 'medium'
        ? 'text-[clamp(2.7rem,14cqi,5.8rem)]'
        : compact
          ? 'text-[clamp(2.5rem,15cqi,5.4rem)]'
          : 'text-[clamp(3rem,18cqi,7rem)]';

  return (
    <div className={`flex min-w-0 items-end ${justify} font-black tabular-nums leading-none tracking-[-0.075em] text-foreground`}>
      <span className={size}>{hours}</span>
      <span
        className={`${scale === 'small' ? 'text-[0.9em]' : 'text-[0.92em]'} mb-[0.07em] px-[0.035em] transition-opacity duration-300`}
        style={{ color: 'hsl(var(--primary))', opacity: blink ? 1 : 0.32 }}
      >
        :
      </span>
      <span className={size}>{minutes}</span>
      {(seconds || period) ? (
        <span className="mb-[0.22em] ml-2 flex shrink-0 flex-col items-start gap-0.5 text-primary">
          {seconds ? <span className="text-[clamp(0.55rem,1.8cqi,0.85rem)] font-black tracking-[0.08em]">{seconds}</span> : null}
          {period ? <span className="text-[clamp(0.46rem,1.45cqi,0.7rem)] font-black uppercase tracking-[0.24em]">{period}</span> : null}
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
  className = '',
}: {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
  minimal?: boolean;
  variant?: 'classic' | 'orbit' | 'minimal';
  className?: string;
}) {
  const resolvedVariant = minimal ? 'minimal' : variant;
  const showNumbers = resolvedVariant === 'minimal';
  const showOrbit = resolvedVariant === 'orbit';
  const marks = Array.from({ length: 60 });

  return (
    <svg
      viewBox="0 0 120 120"
      className={`h-[clamp(7.5rem,26cqi,12rem)] w-[clamp(7.5rem,26cqi,12rem)] overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`hpDialFace-${resolvedVariant}`} cx="50%" cy="42%" r="64%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.98" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.64" />
        </radialGradient>
        <filter id={`hpDialShadow-${resolvedVariant}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="hsl(var(--background))" floodOpacity="0.34" />
        </filter>
      </defs>

      <circle cx="60" cy="60" r="53" fill={`url(#hpDialFace-${resolvedVariant})`} stroke="hsl(var(--border))" strokeOpacity="0.72" strokeWidth="1" filter={`url(#hpDialShadow-${resolvedVariant})`} />
      <circle cx="60" cy="60" r="45" fill="none" stroke="hsl(var(--primary))" strokeOpacity={showOrbit ? '0.26' : '0.12'} strokeWidth="1" />

      {marks.map((_, index) => {
        const angle = (index * 6 * Math.PI) / 180;
        const isHour = index % 5 === 0;
        const inner = isHour ? 41 : 46;
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
            stroke={isHour ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isHour ? '0.7' : '0.28'}
            strokeWidth={isHour ? '1.3' : '0.7'}
            strokeLinecap="round"
          />
        );
      })}

      {showNumbers ? (
        <>
          <text x="60" y="27" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">12</text>
          <text x="94" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">3</text>
          <text x="60" y="98" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">6</text>
          <text x="26" y="63" textAnchor="middle" className="fill-muted-foreground text-[8px] font-black">9</text>
        </>
      ) : null}

      {showOrbit ? (
        <>
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.2" strokeWidth="1.2" />
          <circle cx="60" cy="10" r="4.2" fill="hsl(var(--primary))" transform={`rotate(${secondAngle} 60 60)`} />
        </>
      ) : null}

      <line x1="60" y1="60" x2="60" y2="36" stroke="hsl(var(--foreground))" strokeWidth="3.2" strokeLinecap="round" transform={`rotate(${hourAngle} 60 60)`} />
      <line x1="60" y1="60" x2="60" y2="26" stroke="hsl(var(--muted-foreground))" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${minuteAngle} 60 60)`} />
      <line x1="60" y1="66" x2="60" y2="24" stroke="hsl(var(--primary))" strokeWidth="1.55" strokeLinecap="round" transform={`rotate(${secondAngle} 60 60)`} />

      <circle cx="60" cy="60" r="8" fill="hsl(var(--primary))" />
      <circle cx="60" cy="60" r="3" fill="hsl(var(--background))" />
    </svg>
  );
}