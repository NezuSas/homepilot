import type { ClockDesignProps } from '../clockTypes';
import { formatWeekday, getHandAngles, pad } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

function Hand({ angle, className }: { angle: number; className: string }) {
  return <div className={className} style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 100%' }} />;
}

export function AnalogClassicClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const weekday = formatWeekday(now, locale, 'short');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <ClockShell>
      <div className="relative z-10 flex h-full w-full select-none items-center gap-4 p-4">
        <div className="relative aspect-square h-[82%] min-h-[7rem] rounded-full border border-border/70 bg-background/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_22px_55px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:bg-black/15">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-muted-foreground/45"
              style={{ transform: `translate(-50%, -50%) rotate(${index * 30}deg) translateY(-42%)` }}
            />
          ))}
          <div className="absolute inset-[13%] rounded-full border border-border/40" />
          <Hand angle={angles.hour} className="absolute left-1/2 top-[23%] h-[27%] w-1.5 rounded-full bg-foreground" />
          <Hand angle={angles.minute} className="absolute left-1/2 top-[15%] h-[35%] w-1 rounded-full bg-foreground/80" />
          <Hand angle={angles.second} className="absolute left-1/2 top-[12%] h-[38%] w-0.5 rounded-full bg-primary" />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="text-[clamp(0.52rem,1.55cqi,0.7rem)] font-black uppercase tracking-[0.28em] text-primary">{copy.analogClassic}</div>
            <div className="mt-1 text-[clamp(0.58rem,1.65cqi,0.74rem)] font-bold capitalize text-muted-foreground">{weekday}</div>
          </div>
          <div className="text-[clamp(1.8rem,8cqi,4.8rem)] font-black leading-none tracking-[-0.07em] text-foreground">{time}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} />
        </div>
      </div>
    </ClockShell>
  );
}