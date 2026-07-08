import { useEffect, useMemo, useState } from 'react';
import type { DashboardWidgetConfig } from '../../types';
import { CLOCK_DESIGN_COMPONENTS } from './clockRegistry';
import type { ClockStyle } from './clockTypes';
import { getClockCopy, getClockLocale } from './clockUtils';
import { useCuencaWeather } from './useCuencaWeather';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const locale = useMemo(() => getClockLocale(), []);
  const copy = useMemo(() => getClockCopy(locale), [locale]);
  const { weather, status: weatherStatus } = useCuencaWeather(locale);
  const clockStyle = (config.extra?.clockStyle as ClockStyle | undefined) ?? 'minimal';
  const Design = CLOCK_DESIGN_COMPONENTS[clockStyle] ?? CLOCK_DESIGN_COMPONENTS.minimal;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <Design now={now} config={config} locale={locale} copy={copy} weather={weather} weatherStatus={weatherStatus} />;
}