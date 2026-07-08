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
      className={`relative h-full w-full min-w-0 overflow-hidden rounded-[inherit] text-foreground ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_14%_12%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.96),hsl(var(--background)/0.82))]" />
      <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
      <div className="relative z-10 h-full w-full min-w-0">{children}</div>
    </div>
  );
}

export function ClockLabel({ label, subtle }: { label: string; subtle?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.75)]" />
        <span className="min-w-0 truncate text-[clamp(0.52rem,1.45cqi,0.78rem)] font-black uppercase tracking-[0.42em] text-primary">
          {label}
        </span>
      </div>
      {subtle ? (
        <div className="mt-1 truncate pl-3.5 text-[clamp(0.54rem,1.35cqi,0.72rem)] font-semibold text-muted-foreground">
          {subtle}
        </div>
      ) : null}
    </div>
  );
}

export function WeatherPill({ weather, status, copy, compact = false, className = '' }: WeatherPillProps) {
  const label = formatWeather(weather, status, copy, compact);

  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-full border border-border/55 bg-background/30 px-[clamp(0.55rem,1.8cqi,0.9rem)] py-[clamp(0.22rem,0.72cqi,0.36rem)] ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.75)]" />
        <span className="min-w-0 truncate text-[clamp(0.48rem,1.25cqi,0.72rem)] font-black uppercase tracking-[0.11em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ClockProgress({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0">
      <div className={compact ? 'h-0.5 overflow-hidden rounded-full bg-border/40' : 'h-1 overflow-hidden rounded-full bg-border/45'}>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${safeValue}%`, boxShadow: '0 0 14px hsl(var(--primary)/0.45)' }}
        />
      </div>
      {label ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[clamp(0.48rem,1.15cqi,0.64rem)] font-black uppercase tracking-[0.2em] text-muted-foreground">
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
  const size = compact ? 'text-[clamp(2.25rem,13cqi,4.9rem)]' : 'text-[clamp(3.2rem,17cqi,7.8rem)]';
  const colonSize = compact ? 'text-[clamp(2rem,11cqi,4.2rem)]' : 'text-[clamp(2.8rem,14cqi,6.5rem)]';

  return (
    <div className={`flex min-w-0 items-end ${justify} font-black tabular-nums leading-none tracking-[-0.075em] text-foreground ${className}`}>
      <span className={size}>{hours}</span>
      <span className={`mb-[0.06em] px-[0.035em] ${colonSize}`} style={{ color: 'hsl(var(--primary))', opacity: blink ? 1 : 0.32 }}>
        :
      </span>
      <span className={size}>{minutes}</span>
      {seconds || period ? (
        <span className="mb-[0.22em] ml-2 flex flex-col items-start gap-0.5 text-[clamp(0.55rem,1.65cqi,0.9rem)] font-black uppercase tracking-[0.16em] text-primary">
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
  const marks = Array.from({ length: 60 });
  const showNumbers = resolvedVariant === 'minimal';
  const showOrbit = resolvedVariant === 'orbit';
  const radius = showOrbit ? 55 : 51;

  return (
    <svg viewBox="0 0 140 140" className={`h-[clamp(7rem,30cqi,12.5rem)] w-[clamp(7rem,30cqi,12.5rem)] overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id={`hp-clock-face-${resolvedVariant}`} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.94" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.72" />
        </radialGradient>
      </defs>

      <circle cx="70" cy="70" r={radius} fill={`url(#hp-clock-face-${resolvedVariant})`} stroke="hsl(var(--border))" strokeOpacity="0.75" />
      <circle cx="70" cy="70" r="43" fill="none" stroke="hsl(var(--primary))" strokeOpacity={showOrbit ? '0.28' : '0.12'} />

      {marks.map((_, index) => {
        const angle = (index * 6 * Math.PI) / 180;
        const isHour = index % 5 === 0;
        const inner = isHour ? 47 : 50;
        const outer = isHour ? 55 : 54;
        const x1 = 70 + Math.sin(angle) * inner;
        const y1 = 70 - Math.cos(angle) * inner;
        const x2 = 70 + Math.sin(angle) * outer;
        const y2 = 70 - Math.cos(angle) * outer;
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isHour ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))'}
            strokeOpacity={isHour ? '0.64' : '0.36'}
            strokeWidth={isHour ? '1.8' : '0.85'}
            strokeLinecap="round"
          />
        );
      })}

      {showNumbers ? (
        <>
          <text x="70" y="36" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">12</text>
          <text x="103" y="74" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">3</text>
          <text x="70" y="108" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">6</text>
          <text x="36" y="74" textAnchor="middle" className="fill-muted-foreground text-[10px] font-black">9</text>
        </>
      ) : null}

      {showOrbit ? (
        <circle cx="70" cy="15" r="5" fill="hsl(var(--primary))" transform={`rotate(${secondAngle} 70 70)`} />
      ) : null}

      <line x1="70" y1="70" x2="70" y2="42" stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" transform={`rotate(${hourAngle} 70 70)`} />
      <line x1="70" y1="70" x2="70" y2="28" stroke="hsl(var(--muted-foreground))" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${minuteAngle} 70 70)`} />
      <line x1="70" y1="75" x2="70" y2="30" stroke="hsl(var(--primary))" strokeWidth="1.7" strokeLinecap="round" transform={`rotate(${secondAngle} 70 70)`} />
      <circle cx="70" cy="70" r="9" fill="hsl(var(--primary))" />
      <circle cx="70" cy="70" r="3.5" fill="hsl(var(--background))" />
    </svg>
  );
}