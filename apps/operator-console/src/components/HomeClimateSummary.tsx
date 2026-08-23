import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, Thermometer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getHomeClimateTemperature } from './homeClimateWeather';
import { useCuencaWeather } from '../views/dashboards/widgets/clock/useCuencaWeather';

const configuredCity = (import.meta.env.VITE_HOME_CITY as string | undefined)?.trim() || 'Cuenca';

export const HomeClimateSummary: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const { weather, status: weatherStatus } = useCuencaWeather(i18n.language);
  const temperature = getHomeClimateTemperature(weather, weatherStatus);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now), [i18n.language, now]);

  return (
    <div className="homepilot-home-context flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end" aria-label={t('dashboard.home_context')}>
      <div className="flex min-w-0 basis-full items-center gap-2 rounded-card border border-border/60 bg-card/80 px-3 py-2.5 text-caption text-muted-foreground shadow-sm sm:basis-auto">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate font-semibold text-foreground">{weather?.location ?? configuredCity}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-card border border-border/60 bg-card/80 px-3 py-2.5 text-caption text-muted-foreground shadow-sm sm:flex-none">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
        <time className="min-w-0 truncate font-semibold tabular-nums text-foreground" dateTime={now.toISOString()}>{formattedTime}</time>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-card border border-border/60 bg-card/80 px-3 py-2.5 text-caption text-muted-foreground shadow-sm sm:flex-none">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Thermometer className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate font-semibold tabular-nums text-foreground">
          {temperature === null ? t('dashboard.temperature_unavailable') : `${temperature} °C`}
        </span>
      </div>
    </div>
  );
};
