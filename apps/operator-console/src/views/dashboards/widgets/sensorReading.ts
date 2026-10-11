import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import type { SensorVisualStyle } from './sectionCardCatalog';

export type SensorCategory = 'battery' | 'temperature' | 'humidity' | 'pressure' | 'memory' | 'load' | 'power' | 'energy' | 'signal' | 'illuminance' | 'air_quality' | 'presence' | 'measurement' | 'status';
export type SensorPresentation = 'percentage' | 'temperature' | 'binary' | 'categorical' | 'numeric';

export interface SensorReading {
  value: string | null;
  unit: string | null;
  category: SensorCategory;
  percentage: number | null;
  presentation: SensorPresentation;
  binaryState: 'on' | 'off' | null;
  deviceClass: string;
}

const unavailableStates = new Set(['', 'none', 'null', 'unknown', 'unavailable', 'offline']);
const binaryOnStates = new Set(['on', 'true', 'encendido', 'connected', 'conectado']);
const binaryOffStates = new Set(['off', 'false', 'apagado', 'disconnected', 'desconectado']);
const percentageClasses = new Set(['battery', 'humidity', 'memory', 'cpu', 'gpu', 'processor', 'signal_strength']);
const temperatureUnits = new Set(['°c', '°f']);

// Only categories with meaningful bounded ranges receive severity thresholds.
const BOUNDED_PERCENTAGE_CATEGORIES = new Set<SensorCategory>(['battery', 'humidity', 'memory', 'signal']);

export function asRecord(value: unknown): Record<string, unknown> {
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

export function numericValue(value: string | null): number | null {
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

export function resolveSensorVisualStyle(style: SensorVisualStyle, deviceClass: string, unit: string | null): Exclude<SensorVisualStyle, 'auto'> {
  if (style !== 'auto') return style;
  if (deviceClass === 'temperature' || temperatureUnits.has(unit?.toLowerCase() ?? '')) return 'thermometer';
  if (deviceClass === 'battery') return 'battery';
  if (['humidity', 'pressure', 'power', 'voltage', 'current'].includes(deviceClass)) return 'gauge';
  if (['water_level', 'tank_level', 'fuel_level'].includes(deviceClass) || unit === '%') return 'level';
  return 'gauge';
}
