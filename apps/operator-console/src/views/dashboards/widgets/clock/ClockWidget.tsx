import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../../types';
import { CLOCK_DESIGN_COMPONENTS, normalizeClockStyle } from './clockRegistry';
import { useClockData } from './useClockData';

interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export function ClockWidget({ config }: ClockWidgetProps) {
  const { i18n } = useTranslation();
  const { now, locale, copy, weather, weatherStatus } = useClockData(i18n.language);

  const clockStyle = normalizeClockStyle(config.extra?.clockStyle);
  const Design = CLOCK_DESIGN_COMPONENTS[clockStyle] ?? CLOCK_DESIGN_COMPONENTS.minimal;

  return (
    <Design
      now={now}
      config={config}
      locale={locale}
      copy={copy}
      weather={weather}
      weatherStatus={weatherStatus}
    />
  );
}
