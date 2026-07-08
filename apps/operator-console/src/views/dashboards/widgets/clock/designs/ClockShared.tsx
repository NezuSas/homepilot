import type { ClockCopy, ClockWeather } from '../clockTypes';
import { formatWeather } from '../clockUtils';

interface WeatherPillProps {
  weather: ClockWeather | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  copy: ClockCopy;
  compact?: boolean;
}

export function WeatherPill({ weather, status, copy, compact = false }: WeatherPillProps) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-background/55 px-2.5 py-1 text-[clamp(0.5rem,1.55cqi,0.68rem)] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur-xl dark:bg-white/[0.04]"
      title={formatWeather(weather, status, copy)}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
      {weather && status === 'ready' ? (
        <>
          <span className="truncate">{compact ? weather.location : `${weather.location} Â· ${weather.label}`}</span>
          <span className="text-foreground">{Math.round(weather.temperature)}Â°</span>
        </>
      ) : (
        <span className="truncate">{status === 'error' ? copy.weatherUnavailable : copy.weatherLoading}</span>
      )}
    </div>
  );
}

export function ClockShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate h-full w-full overflow-hidden rounded-[inherit] text-foreground">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_20%_15%,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.96),hsl(var(--background)/0.62))] dark:bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.34),hsl(var(--background)/0.70))]" />
      <div className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] border border-white/35 dark:border-white/[0.06]" />
      {children}
    </div>
  );
}