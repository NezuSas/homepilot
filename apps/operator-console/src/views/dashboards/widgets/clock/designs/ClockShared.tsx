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
      : `${weather?.location} Â· ${weather?.label}`
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
        <span className="shrink-0 text-foreground">{Math.round(weather!.temperature)}Â°</span>
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