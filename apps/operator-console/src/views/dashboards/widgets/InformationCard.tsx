import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { IconButton } from '../../../components/ui/IconButton';
import { HomeContextIndicator } from '../../../components/HomeContextIndicator';
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
    <span>{formatTemperature(weather.temperature)} · {weather.label}</span></>;
}

/** Read-only information: same local time, weather service and sensor model. */
export function InformationCard({ source, device, title, icon, pill = false }: {
  pill?: boolean; source: 'info_time' | 'info_weather' | 'info_sensor'; device?: SnapshotDevice; title: string; icon?: SectionCardIcon;
}) {
  const { t } = useTranslation();
  const Icon = getDashboardIconComponent(icon ?? (source === 'info_time' ? 'Clock' : source === 'info_weather' ? 'Cloud' : 'Gauge'));
  const reading = source === 'info_sensor' ? getSensorReading(device) : undefined;
  const numeric = reading?.value === null || reading?.value === undefined ? NaN : Number(reading.value.replace(',', '.'));
  const value = reading?.value === null || reading?.value === undefined ? t('dashboard.editor.sections.information_unavailable')
    : Number.isFinite(numeric) ? formatSensorValue(numeric, true) : reading.value;
  if (pill) return <HomeContextIndicator icon={Icon} primaryIcon className="dashboard-context-chip">
    {source === 'info_time' ? <TimeBadgeContent bare /> : source === 'info_weather' ? <WeatherInformation /> : <>{title}: {value}{reading?.value != null && reading.unit ? ` ${reading.unit}` : ''}</>}
  </HomeContextIndicator>;
  return <div role="group" aria-label={title} className="flex h-full min-w-0 flex-wrap items-center gap-2 px-3 py-2 text-body-compact font-semibold text-foreground">
    {source === 'info_time' ? <TimeBadgeContent /> : source === 'info_weather' ? <WeatherInformation /> : <>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 break-words">{title}</span>
      <span className="tabular-nums">{value}{reading?.value !== null && reading?.value !== undefined && reading.unit ? ` ${reading.unit}` : ''}</span>
    </>}
  </div>;
}

/** Same explicit pencil affordance as Section cards, without making readings actionable. */
export function EditableInformationCard({ children, isEditing, onEdit }: { children: ReactNode; isEditing: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    if (!isEditing) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setSelected(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [isEditing]);
  return <div ref={root} className="relative group/badge min-w-0 max-w-full"
    onPointerUp={event => { if (isEditing && event.pointerType === 'touch') setSelected(true); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSelected(false); }}>
    {children}
    {isEditing && <div className={`absolute inset-0 flex items-center justify-center rounded-full bg-card/80 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover/badge:opacity-100 group-focus-within/badge:opacity-100'}`}>
      <IconButton icon={Pencil} label={t('common.edit')} size="lg" variant="ghost" onClick={event => { event.stopPropagation(); onEdit(); }} />
    </div>}
  </div>;
}
