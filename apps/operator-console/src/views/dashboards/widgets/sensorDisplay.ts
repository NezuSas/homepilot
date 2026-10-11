import { formatMeasurement } from '../../../lib/formatMeasurement';
import type { SensorCategory } from './sensorReading';

export function displayValue(value: string | null, t: (key: string) => string): string {
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

export function getCategoryLabel(category: SensorCategory, t: (key: string) => string): string {
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
  return formatMeasurement(value, decimals ? 2 : 0);
}
