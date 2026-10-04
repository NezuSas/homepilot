import { Clock3 } from 'lucide-react';
import type { ClockDesignProps } from '../clockTypes';
import { getHandAngles } from '../clockUtils';
import { AnalogDial, ClockShell } from './ClockShared';
import { ClockDateTimeSummary, ClockWeatherSummary } from './ClockSummaries';

/** The single presentation for new and historically persisted clock styles. */
export function HomePilotClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const isEnglish = locale.toLowerCase().startsWith('en');

  return (
    <ClockShell tone="analog" className="homepilot-clock-surface homepilot-clock-reference">
      <div data-homepilot-clock className="homepilot-clock-reference-layout relative z-10">
        <header className="homepilot-clock-reference-header">
          <div className="homepilot-clock-reference-heading">
            <Clock3 aria-hidden="true" className="homepilot-clock-reference-header-icon" />
            <span>{isEnglish ? 'Clock' : 'Reloj'}</span>
          </div>
        </header>

        <div className="homepilot-clock-reference-main">
          <div className="homepilot-clock-reference-dial-frame">
            <AnalogDial
              hourAngle={angles.hour}
              minuteAngle={angles.minute}
              secondAngle={angles.second}
              premium
              className="homepilot-clock-dial"
            />
            <span className="homepilot-clock-reference-brand" aria-hidden="true">HOMEPILOT</span>
          </div>

          <div className="homepilot-clock-reference-details">
            <ClockDateTimeSummary now={now} locale={locale} />
            <div className="homepilot-clock-reference-divider" aria-hidden="true" />
            <ClockWeatherSummary now={now} weather={weather} status={weatherStatus} copy={copy} />
          </div>
        </div>

      </div>
    </ClockShell>
  );
}
