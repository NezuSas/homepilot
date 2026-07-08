import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getHandAngles, getMinuteProgress, pad } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

function Hand({ angle, className }: { angle: number; className: string }) {
  return <div className={className} style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 100%' }} />;
}

export function AnalogOrbitClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const progress = getMinuteProgress(now);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell>
      <div className="relative z-10 flex h-full w-full select-none flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[clamp(0.52rem,1.55cqi,0.7rem)] font-black uppercase tracking-[0.3em] text-primary">{copy.analogOrbit}</div>
            <div className="mt-1 truncate text-[clamp(0.52rem,1.55cqi,0.7rem)] font-bold capitalize text-muted-foreground">{dateLine}</div>
          </div>
          <div className="text-[clamp(0.56rem,1.65cqi,0.74rem)] font-black uppercase tracking-[0.18em] text-primary">{progress}%</div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-5 py-2">
          <div className="relative aspect-square h-[76%] min-h-[7rem] rounded-full border border-border/60 bg-background/55 backdrop-blur-xl dark:bg-black/15">
            <div className="absolute inset-2 rounded-full border border-primary/20" />
            <div className="absolute inset-4 rounded-full border border-border/50" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full bg-primary" style={{ transform: `translate(-50%, -50%) rotate(${angles.second}deg) translateY(-3.1rem)` }} />
            <Hand angle={angles.hour} className="absolute left-1/2 top-[26%] h-[24%] w-1.5 rounded-full bg-foreground" />
            <Hand angle={angles.minute} className="absolute left-1/2 top-[17%] h-[33%] w-1 rounded-full bg-foreground/75" />
            <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
          </div>
          <div className="min-w-0">
            <div className="text-[clamp(2rem,9cqi,5.5rem)] font-black leading-none tracking-[-0.08em] text-foreground">{time}</div>
            <div className="mt-2"><WeatherPill weather={weather} status={weatherStatus} copy={copy} compact /></div>
          </div>
        </div>
      </div>
    </ClockShell>
  );
}