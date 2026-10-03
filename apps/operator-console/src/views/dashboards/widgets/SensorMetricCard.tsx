import type { CSSProperties } from 'react';
import { Activity, BatteryFull, BatteryLow, BatteryMedium, Droplets, Gauge, MemoryStick, Sun, Thermometer, UserRound, Wifi, Wind, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { getDefaultIcon, normalizeSensorScale, type SensorScale, type SectionCardIcon } from './sectionCardCatalog';
import { getSensorGaugeScale, SensorAnalogGauge } from './SensorAnalogGauge';

export type SensorCategory = 'battery' | 'temperature' | 'humidity' | 'pressure' | 'memory' | 'load' | 'power' | 'energy' | 'signal' | 'illuminance' | 'air_quality' | 'presence' | 'measurement' | 'status';
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
  roomName?: string;
  sensorScale?: SensorScale;
  sensorDecimals?: boolean;
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
  if (deviceClass === 'pressure' || ['bar', 'hPa', 'Pa', 'kPa'].includes(unit ?? '')) return 'pressure';
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
  const valueWithUnit = rawValue?.match(/^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(%|°[CF]|kWh|Wh|kW|W|V|A|RPM|rpm|lx|ppm|hPa|kPa|Pa|bar)$/i);
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
    case 'pressure': return <Gauge className={className} />;
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
    case 'charging': return t('dashboard.editor.sections.sensor_charging');
    case 'not charging':
    case 'not_charging': return t('dashboard.editor.sections.sensor_not_charging');
    case 'discharging': return t('dashboard.editor.sections.sensor_discharging');
    default: return value ?? '—';
  }
}

function getCategoryLabel(category: SensorCategory, t: (key: string) => string): string {
  switch (category) {
    case 'battery': return t('dashboard.editor.sections.sensor_battery');
    case 'temperature': return t('dashboard.editor.sections.sensor_temperature');
    case 'humidity': return t('dashboard.editor.sections.sensor_humidity');
    case 'pressure': return t('dashboard.editor.sections.sensor_pressure');
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

export function formatSensorValue(value: number, decimals = false): string {
  return new Intl.NumberFormat(undefined, { useGrouping: false, maximumFractionDigits: decimals ? 2 : 0 }).format(value);
}

function SensorPresentationHero({ reading, t, decimals = false }: {
  reading: SensorReading;
  t: (key: string) => string;
  decimals?: boolean;
}) {
  const available = reading.value !== null;
  const isPercentage = available && reading.presentation === 'percentage';
  const number = numericValue(reading.value);
  const value = reading.binaryState
    ? t(`dashboard.editor.sections.sensor_${reading.binaryState}`)
    : number !== null ? formatSensorValue(number, decimals) : displayValue(reading.value, t);
  const unit = isPercentage ? '%' : reading.unit;
  const readingWidth = value.length * 0.62;
  const readingScale = value.length > 6 ? Math.min(17, 80 / readingWidth) : 17;
  const isState = available && (reading.presentation === 'binary' || reading.presentation === 'categorical');

  return (
    <>
      {isState ? <span aria-hidden="true" className={cn('sensor-state-symbol', reading.binaryState === 'off' && 'sensor-state-symbol-idle')}><CategoryIcon category={reading.category} percentage={reading.percentage} /></span> : null}
      <span className="sensor-reading-value" style={{ '--sensor-reading-scale': `${readingScale}cqi` } as CSSProperties}>
        <span className={cn('sensor-reading-number tabular-nums tracking-tight', !available && 'text-muted-foreground', isState && 'sensor-reading-state', available && numericValue(reading.value) !== null && value.length > 6 && 'sensor-reading-plain')}>
          {value}
        </span>
        {available && unit ? <span className="sensor-reading-unit font-medium text-muted-foreground">{unit}</span> : null}
      </span>
    </>
  );
}

export function SensorMetricCard({ device, title, isPreview = false, icon, roomName, sensorScale, sensorDecimals = false }: SensorMetricCardProps) {
  const { t } = useTranslation();
  const reading = getSensorReading(device, isPreview);
  const severity = getSensorSeverity(reading);
  const isPercentage = reading.value !== null && reading.presentation === 'percentage';
  const number = numericValue(reading.value);
  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  const configuredScale = normalizeSensorScale(sensorScale);
  const scale = configuredScale ? { ...configuredScale, source: 'metadata' as const }
    : number === null ? null : getSensorGaugeScale(number, isPercentage,
      attributes.min_value ?? attributes.min ?? state.min_value ?? state.min,
      attributes.max_value ?? attributes.max ?? state.max_value ?? state.max, reading.unit);
  const analog = number !== null || reading.value === null;
  const categoryLabel = getCategoryLabel(reading.category, t);
  const displayTitle = title.trim() || device?.name?.trim() || categoryLabel;
  const ConfiguredIcon = icon && icon !== getDefaultIcon('sensor') ? getDashboardIconComponent(icon) : null;
  const hasStatus = severity !== 'informational' && reading.presentation !== 'binary';
  const statusLabel = !hasStatus ? null : reading.category === 'memory' && (severity === 'low' || severity === 'critical')
    ? t(`dashboard.editor.sections.sensor_memory_${severity}`)
    : t(`dashboard.editor.sections.sensor_${severity}`);

  return (
    <div
      className="sensor-metric-card homepilot-sensor-reading relative flex h-full min-w-0 flex-col border border-border/55 bg-card/95 text-foreground shadow-surface-card"
      style={{ containerType: 'inline-size', containerName: 'sensor-card' }}
    >
      <div className="sensor-premium-header">
        <span
          className={cn('sensor-category-icon grid shrink-0 place-items-center', severity === 'unavailable' ? 'text-muted-foreground' : 'text-primary')}
          title={categoryLabel}
          aria-hidden="true"
        >
          {ConfiguredIcon ? <ConfiguredIcon className="h-full w-full" /> : <CategoryIcon category={reading.category} percentage={reading.percentage} />}
        </span>
        <div className="min-w-0"><span className="sensor-reading-title block text-foreground">{displayTitle}</span>
          {roomName ? <span className="sensor-reading-room block text-muted-foreground">{roomName}</span> : null}
        </div>
      </div>
      <div className={cn('sensor-reading-layout', analog && 'sensor-analog-layout')}>
        {analog ? <div className="sensor-analog-instrument"
          role={scale && number !== null ? 'meter' : undefined}
          aria-label={scale ? displayTitle : undefined}
          aria-valuemin={number !== null ? scale?.min : undefined} aria-valuemax={number !== null ? scale?.max : undefined}
          aria-valuenow={scale && number !== null ? Math.max(scale.min, Math.min(scale.max, number)) : undefined}
          aria-valuetext={scale && number !== null ? `${reading.value}${isPercentage ? '%' : reading.unit ? ` ${reading.unit}` : ''}` : undefined}
        >
          <SensorAnalogGauge value={number} scale={scale} />
          <div className="sensor-analog-readout"><SensorPresentationHero reading={reading} t={t} decimals={sensorDecimals} /></div>
        </div> : <SensorPresentationHero reading={reading} t={t} decimals={sensorDecimals} />}
      </div>
      <div className="sensor-reading-footer">
        <div className="sensor-reading-status text-muted-foreground">
          {hasStatus ? (
          <span className="sensor-status-badge">
            {severity !== 'unavailable' && <span className={cn('sensor-status-dot', severity === 'critical' ? 'bg-danger' : severity === 'low' ? 'bg-warning' : 'bg-success')} aria-hidden="true" />}
            <span className="min-w-0">{statusLabel}</span>
          </span>
          ) : null}
        </div>
        {scale ? <span className="sensor-scale-caption text-muted-foreground">{t(`dashboard.editor.sections.sensor_scale_${scale.source === 'automatic' ? 'automatic' : 'label'}`)}: {scale.min} – {scale.max}{isPercentage ? ' %' : reading.unit ? ` ${reading.unit}` : ''}</span> : null}
      </div>
    </div>
  );
}
