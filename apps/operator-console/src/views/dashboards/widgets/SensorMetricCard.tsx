import { Activity, BatteryFull, BatteryLow, BatteryMedium, Droplets, Gauge, MemoryStick, Sun, Thermometer, UserRound, Wifi, Wind, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { getDefaultIcon, type SectionCardIcon } from './sectionCardCatalog';

export type SensorCategory = 'battery' | 'temperature' | 'humidity' | 'memory' | 'load' | 'power' | 'energy' | 'signal' | 'illuminance' | 'air_quality' | 'presence' | 'measurement' | 'status';
export type SensorPresentation = 'percentage' | 'temperature' | 'binary' | 'categorical' | 'numeric';

interface SensorReading {
  value: string | null;
  unit: string | null;
  category: SensorCategory;
  percentage: number | null;
  presentation: SensorPresentation;
  binaryState: 'on' | 'off' | null;
  deviceClass: string;
}

interface SensorMetricCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  icon?: SectionCardIcon;
}

const unavailableStates = new Set(['', 'none', 'null', 'unknown', 'unavailable', 'offline']);
const binaryOnStates = new Set(['on', 'true', 'encendido', 'connected', 'conectado']);
const binaryOffStates = new Set(['off', 'false', 'apagado', 'disconnected', 'desconectado']);
const percentageClasses = new Set(['battery', 'humidity', 'memory', 'cpu', 'gpu', 'processor', 'signal_strength']);
const temperatureUnits = new Set(['°c', '°f']);

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
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function numericPercentage(value: string | null): number | null {
  const numeric = numericValue(value);
  return numeric === null ? null : Math.min(100, Math.max(0, numeric));
}

function classifySensor(deviceClass: string, haystack: string, unit: string | null, hasPercentage: boolean): SensorCategory {
  if (deviceClass === 'battery') return 'battery';
  if (deviceClass === 'temperature' || (unit && temperatureUnits.has(unit.toLowerCase()))) return 'temperature';
  if (deviceClass === 'humidity') return 'humidity';
  if (deviceClass === 'memory') return 'memory';
  if (deviceClass === 'cpu' || deviceClass === 'gpu' || deviceClass === 'processor') return 'load';
  if (deviceClass === 'power' || deviceClass === 'voltage') return 'power';
  if (deviceClass === 'energy') return 'energy';
  if (deviceClass === 'connectivity' || deviceClass === 'signal_strength') return 'signal';
  if (haystack.includes('batt') || haystack.includes('bater')) return 'battery';
  if (haystack.includes('temp') || unit === '°C' || unit === '°F') return 'temperature';
  if (haystack.includes('humid') || haystack.includes('humed')) return 'humidity';
  if (haystack.includes('memor') || haystack.includes('ram') || haystack.includes('disk') || haystack.includes('storage') || haystack.includes('almacen')) return 'memory';
  if (haystack.includes('cpu') || haystack.includes('gpu')) return 'load';
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
    return { value: '50', unit: '%', category: 'battery', percentage: 50, presentation: 'percentage', binaryState: null, deviceClass: 'battery' };
  }

  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  const rawValue = firstText([
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
  const metadataUnit = firstText([
    state.unit_of_measurement,
    state.unit,
    state.native_unit_of_measurement,
    attributes.unit_of_measurement,
    attributes.unit,
    attributes.native_unit_of_measurement,
  ]);
  const valueWithUnit = rawValue?.match(/^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(%|°[CF]|kWh|Wh|kW|W|V|A|RPM|rpm|lx|ppm)$/i);
  const value = valueWithUnit ? valueWithUnit[1] : rawValue;
  const unit = metadataUnit ?? valueWithUnit?.[2] ?? null;
  const deviceClass = firstText([state.device_class, state.deviceClass, attributes.device_class, attributes.deviceClass])?.toLowerCase() ?? '';
  const haystack = [
    device?.name,
    device?.externalId,
  ].filter((item): item is string => typeof item === 'string').join(' ').toLocaleLowerCase();

  const percentageCandidate = numericPercentage(value);
  const category = classifySensor(deviceClass, haystack, unit, percentageCandidate !== null && (unit === '%' || unit === null));
  const availableValue = value && !unavailableStates.has(value.toLocaleLowerCase()) ? value : null;
  const binaryValue = availableValue?.toLocaleLowerCase() ?? '';
  const binaryState = binaryOnStates.has(binaryValue) ? 'on' : binaryOffStates.has(binaryValue) ? 'off' : null;
  const isPercentage = percentageCandidate !== null && (unit === '%' || (!unit && (percentageClasses.has(deviceClass) || BOUNDED_PERCENTAGE_CATEGORIES.has(category) || category === 'load')));
  const presentation: SensorPresentation = isPercentage ? 'percentage'
    : category === 'temperature' && percentageCandidate !== null ? 'temperature'
      : binaryState ? 'binary'
        : percentageCandidate !== null ? 'numeric' : 'categorical';

  return {
    value: availableValue,
    unit,
    category,
    percentage: isPercentage && BOUNDED_PERCENTAGE_CATEGORIES.has(category) ? percentageCandidate : null,
    presentation,
    binaryState,
    deviceClass,
  };
}

function BatteryIcon({ percentage }: { percentage: number | null }) {
  const iconClassName = 'h-full w-full';
  if (percentage === null || percentage <= 20) return <BatteryLow className={iconClassName} />;
  if (percentage < 60) return <BatteryMedium className={iconClassName} />;
  return <BatteryFull className={iconClassName} />;
}

function CategoryIcon({ category, percentage }: { category: SensorCategory; percentage: number | null }) {
  const className = 'h-full w-full';
  switch (category) {
    case 'battery': return <BatteryIcon percentage={percentage} />;
    case 'temperature': return <Thermometer className={className} />;
    case 'humidity': return <Droplets className={className} />;
    case 'memory': return <MemoryStick className={className} />;
    case 'load': return <Gauge className={className} />;
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
  return 'informational';
}

function displayValue(value: string | null, t: (key: string) => string): string {
  switch (value?.toLowerCase()) {
    case 'open': return t('dashboard.editor.sections.sensor_open');
    case 'closed': return t('dashboard.editor.sections.sensor_closed');
    default: return value ?? '—';
  }
}

function getCategoryLabel(category: SensorCategory, t: (key: string) => string): string {
  switch (category) {
    case 'battery': return t('dashboard.editor.sections.sensor_battery');
    case 'temperature': return t('dashboard.editor.sections.sensor_temperature');
    case 'humidity': return t('dashboard.editor.sections.sensor_humidity');
    case 'memory': return t('dashboard.editor.sections.sensor_memory');
    case 'load': return t('dashboard.editor.sections.sensor_load');
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

function SensorPresentationHero({ reading, title, t }: {
  reading: SensorReading;
  title: string;
  t: (key: string) => string;
}) {
  const available = reading.value !== null;
  const isPercentage = available && reading.presentation === 'percentage';
  const fill = isPercentage ? numericPercentage(reading.value) ?? 0 : 0;
  const value = reading.binaryState
    ? t(`dashboard.editor.sections.sensor_${reading.binaryState}`)
    : displayValue(reading.value, t);
  const unit = isPercentage ? '%' : reading.unit;
  const useDigitTiles = available && numericValue(reading.value) !== null && value.replace(/\D/g, '').length <= 5;

  return (
    <>
      <span className="sensor-reading-value flex min-w-0 items-baseline gap-1">
        <span className={`min-w-0 font-semibold tabular-nums tracking-tight ${
          !available ? 'text-sensor-value-fluid text-muted-foreground'
            : isPercentage ? 'truncate text-sensor-percentage-value-fluid text-foreground'
            : reading.presentation === 'binary' || reading.presentation === 'categorical'
              ? 'line-clamp-2 break-words text-widget-title-small-fluid text-foreground'
              : 'truncate text-sensor-value-fluid text-foreground'
        }`}>
          {useDigitTiles ? <span className="sensor-digit-reading" role="img" aria-label={value}>
            <span aria-hidden="true" className="inline-flex items-center gap-[0.04em]">
              {Array.from(value).map((character, index) => (
                <span key={index} className={/\d/.test(character) ? 'sensor-reading-digit' : 'sensor-reading-punctuation'}>{character}</span>
              ))}
            </span>
          </span> : value}
        </span>
        {available && unit ? <span className="shrink-0 text-widget-body-lg-fluid font-medium text-muted-foreground">{unit}</span> : null}
      </span>
      {isPercentage ? (
        <span
          role="meter"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fill}
          aria-valuetext={`${reading.value}%`}
          className="sensor-premium-gauge relative block aspect-square h-[clamp(1.25rem,14cqi,2rem)] max-h-full shrink-0"
        >
          <svg aria-hidden="true" className="h-full w-full -rotate-90" viewBox="0 0 80 80">
            <circle className="sensor-premium-gauge-track" cx="40" cy="40" r="34" fill="none" strokeWidth="4" />
            <circle className="sensor-premium-gauge-progress" cx="40" cy="40" r="34" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${fill * 2.1363} 213.63`} />
          </svg>
        </span>
      ) : null}
    </>
  );
}

export function SensorMetricCard({ device, title, isPreview = false, icon }: SensorMetricCardProps) {
  const { t } = useTranslation();
  const reading = getSensorReading(device, isPreview);
  const severity = getSensorSeverity(reading);
  const categoryLabel = getCategoryLabel(reading.category, t);
  const displayTitle = title.trim() || device?.name?.trim() || categoryLabel;
  const ConfiguredIcon = icon && icon !== getDefaultIcon('sensor') ? getDashboardIconComponent(icon) : null;
  const hasStatus = severity !== 'informational' && reading.presentation !== 'binary';
  const statusLabel = !hasStatus ? null : reading.category === 'memory' && (severity === 'low' || severity === 'critical')
    ? t(`dashboard.editor.sections.sensor_memory_${severity}`)
    : t(`dashboard.editor.sections.sensor_${severity}`);

  return (
    <div
      className="sensor-metric-card homepilot-sensor-reading relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-section border border-border/55 bg-card/95 p-[clamp(0.75rem,4cqi,1rem)] text-foreground shadow-surface-card"
      style={{ containerType: 'inline-size' }}
    >
      <div className="sensor-premium-header flex min-w-0 shrink-0 items-center gap-2">
        <span
          className={cn('grid h-5 w-5 shrink-0 place-items-center', severity === 'unavailable' ? 'text-muted-foreground' : 'text-primary')}
          title={categoryLabel}
          aria-hidden="true"
        >
          {ConfiguredIcon ? <ConfiguredIcon className="h-full w-full" /> : <CategoryIcon category={reading.category} percentage={reading.percentage} />}
        </span>
        <span className="sensor-reading-title min-w-0 truncate text-sensor-title-fluid font-medium text-foreground" title={displayTitle}>{displayTitle}</span>
      </div>
      <div className="sensor-reading-layout mt-2 flex min-h-0 min-w-0 flex-1 items-center gap-2">
        <SensorPresentationHero reading={reading} title={displayTitle} t={t} />
      </div>
      <div className="sensor-reading-status mt-1 flex min-h-4 shrink-0 items-center gap-1.5 text-widget-caption-fluid text-muted-foreground">
        {hasStatus ? (
          <>
            {(severity === 'low' || severity === 'critical') && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', severity === 'critical' ? 'bg-danger' : 'bg-warning')} aria-hidden="true" />}
            <span className="min-w-0 truncate">{statusLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
