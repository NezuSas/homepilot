import { Activity, BatteryFull, BatteryLow, BatteryMedium, Droplets, Gauge, MemoryStick, Sun, Thermometer, UserRound, Wifi, Wind, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

export type SensorCategory = 'battery' | 'temperature' | 'humidity' | 'memory' | 'power' | 'energy' | 'signal' | 'illuminance' | 'air_quality' | 'presence' | 'measurement' | 'status';

interface SensorReading {
  value: string | null;
  unit: string | null;
  category: SensorCategory;
  percentage: number | null;
}

interface SensorMetricCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
}

const unavailableStates = new Set(['', 'none', 'null', 'unknown', 'unavailable', 'offline']);

// Only categories with meaningful bounded ranges receive severity thresholds.
const BOUNDED_PERCENTAGE_CATEGORIES = new Set<SensorCategory>(['battery', 'humidity', 'memory', 'signal']);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return String(value);
  }
  return null;
}

function numericValue(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function numericPercentage(value: string | null): number | null {
  const numeric = numericValue(value);
  return numeric === null ? null : Math.min(100, Math.max(0, numeric));
}

function classifySensor(haystack: string, unit: string | null, hasPercentage: boolean): SensorCategory {
  if (haystack.includes('batt') || haystack.includes('bater')) return 'battery';
  if (haystack.includes('temp') || unit === '°C' || unit === '°F') return 'temperature';
  if (haystack.includes('humid') || haystack.includes('humed')) return 'humidity';
  if (haystack.includes('memor') || haystack.includes('ram') || haystack.includes('cpu') || haystack.includes('disk') || haystack.includes('storage') || haystack.includes('almacen')) return 'memory';
  if (haystack.includes('energ') || unit === 'kWh' || unit === 'Wh') return 'energy';
  if (haystack.includes('power') || haystack.includes('potenc') || unit === 'W' || unit === 'kW') return 'power';
  if (haystack.includes('signal') || haystack.includes('wifi') || haystack.includes('rssi') || haystack.includes('señal')) return 'signal';
  if (haystack.includes('lux') || haystack.includes('illumin') || haystack.includes('ilumin') || unit === 'lx') return 'illuminance';
  if (haystack.includes('air quality') || haystack.includes('calidad de aire') || haystack.includes('co2') || unit === 'ppm') return 'air_quality';
  if (haystack.includes('presen') || haystack.includes('ocupa')) return 'presence';
  if (hasPercentage) return 'measurement';
  return 'status';
}

export function getSensorReading(device?: SnapshotDevice, isPreview = false): SensorReading {
  if (!device && isPreview) {
    return { value: '50', unit: '%', category: 'battery', percentage: 50 };
  }

  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  const value = firstText([
    state.state,
    state.value,
    state.native_value,
    state.level,
    state.battery,
    attributes.state,
    attributes.value,
    attributes.native_value,
    attributes.battery_level,
  ]);
  const unit = firstText([
    state.unit_of_measurement,
    state.unit,
    attributes.unit_of_measurement,
    attributes.unit,
  ]);
  const haystack = [
    device?.name,
    device?.externalId,
    state.device_class,
    attributes.device_class,
  ].filter((item): item is string => typeof item === 'string').join(' ').toLocaleLowerCase();

  const percentageCandidate = numericPercentage(value);
  const category = classifySensor(haystack, unit, percentageCandidate !== null && (unit === '%' || unit === null));

  return {
    value: value && !unavailableStates.has(value.toLocaleLowerCase()) ? value : null,
    unit,
    category,
    percentage: BOUNDED_PERCENTAGE_CATEGORIES.has(category) ? percentageCandidate : null,
  };
}

function BatteryIcon({ percentage }: { percentage: number | null }) {
  const iconClassName = 'h-[52%] w-[52%]';
  if (percentage === null || percentage <= 20) return <BatteryLow className={iconClassName} />;
  if (percentage < 60) return <BatteryMedium className={iconClassName} />;
  return <BatteryFull className={iconClassName} />;
}

function CategoryIcon({ category, percentage }: { category: SensorCategory; percentage: number | null }) {
  const className = 'h-[52%] w-[52%]';
  switch (category) {
    case 'battery': return <BatteryIcon percentage={percentage} />;
    case 'temperature': return <Thermometer className={className} />;
    case 'humidity': return <Droplets className={className} />;
    case 'memory': return <MemoryStick className={className} />;
    case 'power': return <Zap className={className} />;
    case 'energy': return <Zap className={className} />;
    case 'signal': return <Wifi className={className} />;
    case 'illuminance': return <Sun className={className} />;
    case 'air_quality': return <Wind className={className} />;
    case 'presence': return <UserRound className={className} />;
    case 'measurement': return <Gauge className={className} />;
    default: return <Activity className={className} />;
  }
}

export type SensorSeverity = 'normal' | 'low' | 'critical' | 'unavailable' | 'informational';

/** Thresholds are retained from the existing bounded sensor policy. Unbounded
 * values (power, energy, lux, text) do not imply a health judgment. */
export function getSensorSeverity(reading: SensorReading): SensorSeverity {
  if (reading.value === null) return 'unavailable';
  const percentage = reading.percentage;
  if (reading.category === 'battery' || reading.category === 'signal') {
    if (percentage === null) return 'informational';
    return percentage <= 20 ? 'critical' : percentage < 50 ? 'low' : 'normal';
  }
  if (reading.category === 'memory') {
    if (percentage === null) return 'informational';
    return percentage >= 85 ? 'critical' : percentage >= 65 ? 'low' : 'normal';
  }
  if (reading.category === 'humidity') {
    if (percentage === null) return 'informational';
    return percentage < 25 || percentage > 70 ? 'low' : 'normal';
  }
  if (reading.category === 'temperature') {
    const numeric = numericValue(reading.value);
    if (numeric === null) return 'informational';
    return numeric > 30 ? 'critical' : numeric < 15 ? 'low' : 'normal';
  }
  return 'informational';
}

function displayValue(value: string | null, t: (key: string) => string): string {
  switch (value?.toLowerCase()) {
    case 'open': return t('dashboard.editor.sections.sensor_open');
    case 'closed': return t('dashboard.editor.sections.sensor_closed');
    case 'on':
    case 'true': return t('dashboard.editor.sections.sensor_active');
    case 'off':
    case 'false': return t('dashboard.editor.sections.sensor_inactive');
    default: return value ?? '—';
  }
}

function getCategoryLabel(category: SensorCategory, t: (key: string) => string): string {
  switch (category) {
    case 'battery': return t('dashboard.editor.sections.sensor_battery');
    case 'temperature': return t('dashboard.editor.sections.sensor_temperature');
    case 'humidity': return t('dashboard.editor.sections.sensor_humidity');
    case 'memory': return t('dashboard.editor.sections.sensor_memory');
    case 'power': return t('dashboard.editor.sections.sensor_power');
    case 'energy': return t('dashboard.editor.sections.sensor_energy');
    case 'signal': return t('dashboard.editor.sections.sensor_signal');
    case 'illuminance': return t('dashboard.editor.sections.sensor_illuminance');
    case 'air_quality': return t('dashboard.editor.sections.sensor_air_quality');
    case 'presence': return t('dashboard.editor.sections.sensor_presence');
    case 'measurement': return t('dashboard.editor.sections.sensor_measurement');
    default: return t('dashboard.editor.sections.sensor_status');
  }
}

export function SensorMetricCard({ device, title, isPreview = false }: SensorMetricCardProps) {
  const { t } = useTranslation();
  const reading = getSensorReading(device, isPreview);
  const severity = getSensorSeverity(reading);
  const toneClassName = severity === 'critical' ? 'text-danger'
    : severity === 'low' ? 'text-warning'
      : severity === 'normal' ? 'text-success' : 'text-muted-foreground';
  const categoryLabel = getCategoryLabel(reading.category, t);
  const statusLabel = severity === 'informational' ? t('dashboard.editor.sections.sensor_live_reading')
    : t(`dashboard.editor.sections.sensor_${severity}`);

  return (
    <div
      className="sensor-metric-card homepilot-sensor-reading relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-section border border-border/60 bg-card/95 p-[clamp(0.75rem,4cqi,1rem)] text-foreground"
      style={{ containerType: 'inline-size' }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-control bg-muted/60',
            toneClassName,
          )}
          aria-label={categoryLabel}
        >
          <CategoryIcon category={reading.category} percentage={reading.percentage} />
        </span>
        <span className="sensor-category-badge min-w-0 truncate pt-2 text-caption font-semibold text-muted-foreground">{categoryLabel}</span>
      </div>
      <div className="sensor-reading-layout sensor-reading-layout--value mt-3 flex min-h-0 min-w-0 flex-1 flex-col justify-center">
        <div className="sensor-reading-value flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="max-w-full break-words text-sensor-value-fluid font-black tabular-nums leading-none text-foreground">
            {displayValue(reading.value, t)}
          </span>
          {reading.value !== null && reading.unit ? (
            <span className="text-card-title font-semibold text-muted-foreground">{reading.unit}</span>
          ) : null}
        </div>
        <span className="sensor-reading-copy mt-2 block min-w-0 line-clamp-2 text-sensor-title-fluid font-semibold text-foreground" title={title}>{title}</span>
      </div>
      <p className={cn('sensor-reading-status mt-2 min-w-0 truncate text-caption font-semibold', toneClassName)}>{statusLabel}</p>
    </div>
  );
}
