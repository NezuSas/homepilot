import { Clock3, Cloud } from 'lucide-react';
import type { ClockDesignProps } from '../clockTypes';
import { formatMonth, formatTemperature, formatWeekday, getHandAngles, isDaytimeHour, pad } from '../clockUtils';
import { AnalogDial, ClockShell } from './ClockShared';
import { getWeatherCategory, WeatherScene } from './WeatherScene';

/** The single presentation for new and historically persisted clock styles. */
export function HomePilotClock({ now, locale, copy, weather, weatherStatus }: ClockDesignProps) {
  const angles = getHandAngles(now);
  const isEnglish = locale.toLowerCase().startsWith('en');
  const date = isEnglish
    ? `${formatMonth(now, locale, 'long')} ${now.getDate()}`
    : `${now.getDate()} de ${formatMonth(now, locale, 'long')}`;
  const hasWeather = weatherStatus === 'ready' && weather !== null;
  const weatherCategory = hasWeather ? getWeatherCategory(weather.code, isDaytimeHour(now)) : null;

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
            <div className="homepilot-clock-reference-time tabular-nums">
              {pad(now.getHours())}:{pad(now.getMinutes())}
            </div>
            <div className="homepilot-clock-reference-weekday">{formatWeekday(now, locale, 'long')}</div>
            <div className="homepilot-clock-reference-date">{date}</div>
            <div className="homepilot-clock-reference-divider" aria-hidden="true" />
            <div className="homepilot-clock-reference-weather" aria-live="polite">
              {weatherCategory
                ? <WeatherScene category={weatherCategory} size="md" className="homepilot-clock-reference-weather-icon" />
                : <Cloud aria-hidden="true" className="homepilot-clock-reference-weather-icon" />}
              <div className="homepilot-clock-reference-weather-info">
                <span className="homepilot-clock-reference-location">{weather?.location ?? copy.cuenca}</span>
                <strong className="homepilot-clock-reference-temperature tabular-nums">
                  {hasWeather ? formatTemperature(weather.temperature) : '—'}
                </strong>
              </div>
              <div className="homepilot-clock-reference-condition">
                {hasWeather ? weather.label : weatherStatus === 'idle' || weatherStatus === 'loading' ? copy.weatherLoading : copy.weatherUnavailable}
              </div>
            </div>
          </div>
        </div>

        <div className="homepilot-clock-reference-quote">
          <span aria-hidden="true" className="homepilot-clock-reference-quote-mark">“</span>
          <p>
            {isEnglish ? 'Great spaces' : 'Los grandes espacios'}<br />
            {isEnglish ? 'begin with great control.' : 'empiezan con un buen control.'}
          </p>
        </div>
      </div>
    </ClockShell>
  );
}
