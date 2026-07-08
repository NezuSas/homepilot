import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, getHandAngles, pad } from '../clockUtils';
import { ClockShell, WeatherPill } from './ClockShared';

function Hand({ angle, className }: { angle: number; className: string }) {
  return <div className={className} style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 100%' }} />;
}

export function AnalogMinimalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const month = formatMonth(now, locale, 'short').replace('.', '');
  const day = now.getDate();

  return (
    <ClockShell>
      <div className="relative z-10 flex h-full w-full select-none flex-col items-center justify-between p-4 text-center">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-left text-[clamp(0.52rem,1.55cqi,0.7rem)] font-black uppercase tracking-[0.3em] text-primary">{copy.analogMinimal}</div>
          <div className="rounded-full border border-border/50 bg-background/55 px-2.5 py-1 text-[clamp(0.48rem,1.4cqi,0.62rem)] font-black uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
            {month} {day}
          </div>
        </div>

        <div className="relative aspect-square h-[58%] min-h-[7rem] rounded-full border border-border/60 bg-background/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.20)] backdrop-blur-xl dark:bg-black/15">
          <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[0.62rem] font-black text-muted-foreground/60">12</span>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[0.62rem] font-black text-muted-foreground/60">6</span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.62rem] font-black text-muted-foreground/60">3</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.62rem] font-black text-muted-foreground/60">9</span>
          <Hand angle={angles.hour} className="absolute left-1/2 top-[25%] h-[25%] w-1.5 rounded-full bg-foreground" />
          <Hand angle={angles.minute} className="absolute left-1/2 top-[15%] h-[35%] w-1 rounded-full bg-foreground/75" />
          <Hand angle={angles.second} className="absolute left-1/2 top-[11%] h-[39%] w-0.5 rounded-full bg-primary" />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
        </div>

        <div className="w-full space-y-2">
          <div className="text-[clamp(1.45rem,6cqi,3.4rem)] font-black leading-none tracking-[-0.06em] text-foreground">{pad(now.getHours())}:{pad(now.getMinutes())}</div>
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} compact />
        </div>
      </div>
    </ClockShell>
  );
}