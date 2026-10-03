import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { TimeBadgeContent } from './DashboardTitleBadges';
import { useCuencaWeather } from './clock/useCuencaWeather';
import { formatTemperature, getClockLocale, isDaytimeHour } from './clock/clockUtils';
import { WeatherScene, getWeatherCategory } from './clock/designs/WeatherScene';
import { getSensorReading, formatSensorValue } from './SensorMetricCard';
import type { SectionCardIcon } from './sectionCardCatalog';

export function InformationCardSkeleton() {
  return <span aria-hidden="true" className="inline-flex w-full items-center gap-2 p-2">
    <span className="h-5 w-5 shrink-0 animate-pulse rounded-control bg-muted" />
    <span className="h-4 w-24 max-w-full animate-pulse rounded-control bg-muted" />
  </span>;
}

function WeatherInformation() {
  const { t } = useTranslation();
  const { weather, status } = useCuencaWeather(getClockLocale());
  if (status === 'loading') return <InformationCardSkeleton />;
  if (!weather || status !== 'ready') return <span>{t('dashboard.editor.sections.information_unavailable')}</span>;
  return <><WeatherScene category={getWeatherCategory(weather.code, isDaytimeHour(new Date()))} size="sm" className="h-5 w-5 shrink-0" />
    <span>{formatTemperature(weather.temperature)}</span></>;
}

/** Read-only information: same local time, weather service and sensor model. */
export function InformationCard({ source, device, title, icon }: {
  source: 'info_time' | 'info_weather' | 'info_sensor'; device?: SnapshotDevice; title: string; icon?: SectionCardIcon;
}) {
  const { t } = useTranslation();
  const Icon = getDashboardIconComponent(icon ?? 'Gauge');
  const reading = source === 'info_sensor' ? getSensorReading(device) : undefined;
  const numeric = reading?.value === null || reading?.value === undefined ? NaN : Number(reading.value.replace(',', '.'));
  const value = reading?.value === null || reading?.value === undefined ? t('dashboard.editor.sections.information_unavailable')
    : Number.isFinite(numeric) ? formatSensorValue(numeric, true) : reading.value;
  return <div role="group" aria-label={title} className="flex h-full min-w-0 flex-wrap items-center gap-2 px-3 py-2 text-body-compact font-semibold text-foreground">
    {source === 'info_time' ? <TimeBadgeContent /> : source === 'info_weather' ? <WeatherInformation /> : <>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 break-words">{title}</span>
      <span className="tabular-nums">{value}{reading?.value !== null && reading?.value !== undefined && reading.unit ? ` ${reading.unit}` : ''}</span>
    </>}
  </div>;
}
