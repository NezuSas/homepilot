import { useEffect, useState } from 'react';
import type { DashboardWidgetConfig } from '../types';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const accentColor = config.appearance?.accentColor;

  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-1 p-4 select-none"
      style={accentColor ? { '--clock-accent': accentColor } as React.CSSProperties : undefined}
    >
      {/* Time */}
      <div
        className="font-black tabular-nums leading-none tracking-tight"
        style={{
          fontSize: 'clamp(2rem, 8cqi, 5rem)',
          color: accentColor ?? 'hsl(var(--foreground))',
        }}
      >
        {hours}
        <span
          className="animate-pulse"
          style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : 0.3, transition: 'opacity 0.3s' }}
        >
          :
        </span>
        {minutes}
        <span
          className="text-[0.45em] font-semibold opacity-40 ml-1"
        >
          {seconds}
        </span>
      </div>

      {/* Date */}
      <div className="flex flex-col items-center gap-0.5 mt-1">
        <span
          className="text-[clamp(0.6rem,2cqi,0.875rem)] font-black uppercase tracking-[0.15em]"
          style={{ color: accentColor ? `${accentColor}cc` : 'hsl(var(--muted-foreground))' }}
        >
          {dayName}
        </span>
        <span className="text-[clamp(0.5rem,1.5cqi,0.75rem)] font-semibold text-muted-foreground/50 tracking-wide">
          {dateStr}
        </span>
      </div>

      {/* Optional title */}
      {config.appearance?.showTitle && config.appearance.title && (
        <span className="absolute bottom-3 left-0 right-0 text-center text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
          {config.appearance.title}
        </span>
      )}
    </div>
  );
}
