import { Activity, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Droplets, Gauge, MemoryStick, Thermometer, Wifi, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

export type SensorCategory = 'battery' | 'temperature' | 'humidity' | 'memory' | 'power' | 'signal' | 'measurement' | 'status';

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

const unavailableStates = new Set(['', 'none', 'null', 'unknown', 'unavailable']);

// Percentage-bounded categories get the circular gauge; the rest (temperature,
// power, generic measurements) show the raw value — a °C or W reading isn't
// naturally 0-100, so a ring around it would be misleading.
const RING_CATEGORIES = new Set<SensorCategory>(['battery', 'humidity', 'memory', 'signal']);

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
  if (haystack.includes('power') || haystack.includes('energ') || unit === 'W' || unit === 'kWh' || unit === 'kW') return 'power';
  if (haystack.includes('signal') || haystack.includes('wifi') || haystack.includes('rssi') || haystack.includes('señal')) return 'signal';
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
    percentage: RING_CATEGORIES.has(category) ? percentageCandidate : null,
  };
}

function BatteryIcon({ percentage }: { percentage: number | null }) {
  const iconClassName = 'h-[52%] w-[52%]';
  if (percentage === null || percentage <= 20) return <BatteryLow className={iconClassName} />;
  if (percentage < 60) return <BatteryMedium className={iconClassName} />;
  if (percentage < 95) return <BatteryCharging className={iconClassName} />;
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
    case 'signal': return <Wifi className={className} />;
    case 'measurement': return <Gauge className={className} />;
    default: return <Activity className={className} />;
  }
}

/** Higher-is-better categories (battery, signal) vs. higher-is-worse (memory
 * usage) get opposite color ramps; humidity is best around the middle. */
function getToneClassName(category: SensorCategory, percentage: number | null, rawValue: string | null): string {
  if (percentage === null) {
    if (category === 'temperature') {
      const numeric = numericValue(rawValue);
      if (numeric === null) return 'text-muted-foreground';
      if (numeric < 15) return 'text-sky-500';
      if (numeric > 30) return 'text-rose-500';
      return 'text-emerald-500';
    }
    if (category === 'power') return 'text-amber-500';
    return 'text-primary';
  }

  if (category === 'memory') {
    if (percentage >= 85) return 'text-destructive';
    if (percentage >= 65) return 'text-amber-500';
    return 'text-emerald-500';
  }

  if (category === 'humidity') {
    if (percentage < 25 || percentage > 70) return 'text-amber-500';
    return 'text-sky-500';
  }

  // battery / signal: higher is better.
  if (percentage <= 20) return 'text-destructive';
  if (percentage < 50) return 'text-amber-500';
  return 'text-emerald-500';
}

function getCategoryLabel(category: SensorCategory, t: (key: string) => string): string {
  switch (category) {
    case 'battery': return t('dashboard.editor.sections.sensor_battery');
    case 'temperature': return t('dashboard.editor.sections.sensor_temperature');
    case 'humidity': return t('dashboard.editor.sections.sensor_humidity');
    case 'memory': return t('dashboard.editor.sections.sensor_memory');
    case 'power': return t('dashboard.editor.sections.sensor_power');
    case 'signal': return t('dashboard.editor.sections.sensor_signal');
    case 'measurement': return t('dashboard.editor.sections.sensor_measurement');
    default: return t('dashboard.editor.sections.sensor_status');
  }
}

export function SensorMetricCard({ device, title, isPreview = false }: SensorMetricCardProps) {
  const { t } = useTranslation();
  const reading = getSensorReading(device, isPreview);
  const isUnavailable = reading.value === null;
  const showRing = reading.percentage !== null;
  const percentage = reading.percentage ?? 0;
  const circumference = 2 * Math.PI * 42;
  const strokeOffset = circumference - (circumference * percentage) / 100;
  const toneClassName = getToneClassName(reading.category, reading.percentage, reading.value);
  const categoryLabel = getCategoryLabel(reading.category, t);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-border/60 bg-card/95 p-[clamp(0.75rem,4cqi,1rem)] text-foreground shadow-surface-card ring-1 ring-background/45" style={{ containerType: 'inline-size' }}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn(
          'grid h-[clamp(2rem,14cqi,2.5rem)] w-[clamp(2rem,14cqi,2.5rem)] shrink-0 place-items-center rounded-2xl border border-border/60 bg-muted/60 text-muted-foreground',
          !isUnavailable && toneClassName,
        )}>
          <CategoryIcon category={reading.category} percentage={reading.percentage} />
        </span>
        <span className="min-w-0 truncate rounded-full border border-border/55 bg-background/80 px-2.5 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">
          {categoryLabel}
        </span>
      </div>

      <div className="mt-[clamp(0.5rem,3cqi,1rem)] flex min-h-0 flex-1 flex-wrap items-center gap-3">
        {showRing ? (
          <div className="relative grid h-[clamp(3.5rem,26cqi,6rem)] w-[clamp(3.5rem,26cqi,6rem)] shrink-0 place-items-center" aria-label={categoryLabel}>
            <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="52" cy="52" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-muted/80" />
              <circle
                cx="52"
                cy="52"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className={cn('transition-[stroke-dashoffset] duration-500', toneClassName)}
              />
            </svg>
            <span className="absolute text-sensor-ring-value-fluid font-black tabular-nums text-foreground">
              {isUnavailable ? '—' : `${Math.round(percentage)}%`}
            </span>
          </div>
        ) : (
          <div className="min-w-0 shrink-0">
            <span className={cn('block text-sensor-value-fluid font-black tabular-nums', isUnavailable ? 'text-foreground' : toneClassName)}>
              {reading.value ?? '—'}
            </span>
            {reading.unit ? (
              <span className="mt-1 block text-caption font-black uppercase tracking-control text-muted-foreground">{reading.unit}</span>
            ) : null}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <span className="block line-clamp-2 text-sensor-title-fluid font-black text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-caption font-semibold leading-snug text-muted-foreground">
            {isUnavailable ? t('dashboard.editor.sections.sensor_unavailable') : categoryLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-border/45 bg-background/40 px-3 py-2">
        <span className="truncate text-micro font-black uppercase tracking-status text-muted-foreground">
          {t('dashboard.editor.sections.sensor_live_reading')}
        </span>
        <span className={cn('shrink-0 text-micro font-black uppercase tracking-status', isUnavailable ? 'text-muted-foreground' : 'text-primary')}>
          {isUnavailable ? t('dashboard.editor.sections.sensor_unavailable') : t('dashboard.editor.sections.ready')}
        </span>
      </div>
    </div>
  );
}
