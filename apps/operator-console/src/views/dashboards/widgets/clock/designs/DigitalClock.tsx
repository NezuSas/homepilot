import type { ClockDesignProps } from '../clockTypes';
import { formatDateLine, getMinuteProgress, getPeriod, pad, to12Hour } from '../clockUtils';
import { ClockLabel, ClockProgress, ClockShell, TimeText, WeatherPill } from './ClockShared';

export function DigitalClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const hours = pad(to12Hour(now.getHours()));
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const period = getPeriod(now.getHours(), copy);
  const blink = now.getSeconds() % 2 === 0;
  const progress = getMinuteProgress(now);
  const dateLine = formatDateLine(now, locale);

  return (
    <ClockShell tone="neutral" className="p-clock-shell">
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ClockLabel>{copy.digitalPro}</ClockLabel>
            <div className="mt-2 truncate text-clock-digital-label-fluid font-semibold text-muted-foreground">{dateLine}</div>
          </div>
          <div className="grid h-clock-orb w-clock-orb place-items-center rounded-full border border-border/60 bg-background/38 text-center shadow-inner">
            <span className="text-clock-digital-body-fluid font-black text-foreground">{seconds}</span>
            <span className="-mt-2 text-clock-digital-micro-fluid font-black uppercase tracking-status text-primary">{copy.secondsShort}</span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center py-clock-section-y">
          <div className="rounded-panel border border-border/55 bg-background/34 px-clock-pad-x py-clock-pad-y shadow-clock-digital">
            <TimeText hours={hours} minutes={minutes} period={period} blink={blink} size="medium" />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.8rem,7rem)] items-end gap-3 max-[440px]:grid-cols-1">
          <WeatherPill weather={weather} status={weatherStatus} copy={copy} mode="compact" />
          <ClockProgress value={progress} label={copy.sync} compact />
        </div>
      </div>
    </ClockShell>
  );
}
