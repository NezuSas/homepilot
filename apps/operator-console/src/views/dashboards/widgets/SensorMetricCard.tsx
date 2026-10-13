import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { getDefaultIcon, normalizeSensorScale, normalizeSensorVisualStyle, type SensorScale, type SensorVisualStyle, type SectionCardIcon } from './sectionCardCatalog';
import { getSensorGaugeScale, SensorAnalogGauge } from './SensorAnalogGauge';
import { SensorThermometer } from './SensorThermometer';
import { SensorLevelGauge } from './SensorLevelGauge';
import { SensorBatteryGauge } from './SensorBatteryGauge';
import { CategoryIcon } from './SensorCategoryIcon';
import { SensorPresentationHero } from './SensorPresentationHero';
import { SensorBinaryInstrument } from './SensorBinaryInstrument';
import { SensorCompactBar } from './SensorCompactBar';
import { getCategoryLabel } from './sensorDisplay';
import { asRecord, getSensorReading, getSensorSeverity, numericValue, resolveSensorVisualStyle } from './sensorReading';
import { isPlcIntegration } from '../../../../../../packages/devices/domain/integrationCatalog';

export type { SensorCategory, SensorPresentation, SensorSeverity } from './sensorReading';
export { formatSensorValue } from './sensorDisplay';
export { getSensorReading, getSensorSeverity, resolveSensorVisualStyle };

interface SensorMetricCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  icon?: SectionCardIcon;
  roomName?: string;
  sensorScale?: SensorScale;
  sensorDecimals?: boolean;
  visualStyle?: SensorVisualStyle;
}

export function SensorMetricCard({ device, title, isPreview = false, icon, roomName, sensorScale, sensorDecimals = false, visualStyle }: SensorMetricCardProps) {
  const { t, i18n } = useTranslation();
  const initialReading = getSensorReading(device, isPreview);
  const state = asRecord(device?.lastKnownState);
  const inheritedStyle = isPlcIntegration(device?.integrationSource) ? state.plcVisualStyle : undefined;
  const selectedStyle = normalizeSensorVisualStyle(visualStyle ?? inheritedStyle);
  const inferredBinary = initialReading.presentation === 'binary' || device?.type === 'binary_sensor' || device?.type === 'switch' || ['input', 'output', 'output_command', 'output_feedback'].includes(String(state.plcRole ?? ''));
  const binarySensor = selectedStyle === 'switch' || ((visualStyle === undefined || selectedStyle === 'auto') && inferredBinary);
  const bit = initialReading.binaryState ?? (initialReading.value === '1' ? 'on' : initialReading.value === '0' ? 'off' : null);
  const reading = binarySensor ? { ...initialReading, presentation: 'binary' as const, binaryState: bit, value: bit ? initialReading.value : null }
    : inferredBinary && visualStyle !== undefined && selectedStyle !== 'auto'
      ? { ...initialReading, presentation: 'numeric' as const, binaryState: null, value: bit === 'on' ? '1' : bit === 'off' ? '0' : null, unit: null }
      : initialReading;
  const severity = getSensorSeverity(reading);
  const isPercentage = reading.value !== null && reading.presentation === 'percentage';
  const number = numericValue(reading.value);
  const attributes = asRecord(state.attributes);
  const configuredScale = normalizeSensorScale(sensorScale);
  const scale = configuredScale ? { ...configuredScale, source: 'metadata' as const }
    : number === null ? null : getSensorGaugeScale(number, isPercentage,
      attributes.min_value ?? attributes.min ?? state.min_value ?? state.min,
      attributes.max_value ?? attributes.max ?? state.max_value ?? state.max, reading.unit);
  const analog = !binarySensor && (number !== null || reading.value === null);
  const resolvedStyle = resolveSensorVisualStyle(selectedStyle, reading.deviceClass, reading.unit);
  const Visualizer = resolvedStyle === 'thermometer' ? SensorThermometer : resolvedStyle === 'level' ? SensorLevelGauge : resolvedStyle === 'battery' ? SensorBatteryGauge : SensorAnalogGauge;
  const categoryLabel = getCategoryLabel(reading.category, t);
  const displayTitle = title.trim() || device?.name?.trim() || categoryLabel;
  const ConfiguredIcon = icon && icon !== getDefaultIcon('sensor') ? getDashboardIconComponent(icon) : null;
  const hasStatus = (severity === 'low' || severity === 'critical') && reading.presentation !== 'binary';
  const statusLabel = !hasStatus ? null : reading.category === 'memory' && (severity === 'low' || severity === 'critical')
    ? t(`dashboard.editor.sections.sensor_memory_${severity}`)
    : t(`dashboard.editor.sections.sensor_${severity}`);
  const heroDecimals = sensorDecimals || isPlcIntegration(device?.integrationSource);

  return (
    <div
      className="sensor-metric-card homepilot-sensor-reading relative flex h-full min-w-0 flex-col border border-border/55 bg-card/95 text-foreground shadow-surface-card"
      style={{ containerName: 'sensor-card', '--sensor-reserved-height': hasStatus ? '6.5rem' : '5rem' } as CSSProperties}
    >
      <div className="sensor-premium-header">
        <span
          className={cn('sensor-category-icon grid shrink-0 place-items-center', severity === 'unavailable' ? 'text-muted-foreground' : 'text-primary')}
          title={categoryLabel}
          aria-hidden="true"
        >
          {ConfiguredIcon ? <ConfiguredIcon className="h-full w-full" /> : <CategoryIcon category={reading.category} percentage={reading.percentage} />}
        </span>
        <div className="min-w-0"><span title={displayTitle} lang={i18n?.language} className="sensor-reading-title block text-foreground">{displayTitle}</span>
          {roomName ? <span className="sensor-reading-room block text-muted-foreground">{roomName}</span> : null}
        </div>
      </div>
      <div className={cn('sensor-reading-layout', analog && 'sensor-analog-layout')}>
        {binarySensor ? <SensorBinaryInstrument reading={reading} t={t} /> : analog ? <div className="sensor-analog-instrument"
          role={scale && number !== null ? 'meter' : undefined}
          aria-label={scale ? displayTitle : undefined}
          aria-valuemin={number !== null ? scale?.min : undefined} aria-valuemax={number !== null ? scale?.max : undefined}
          aria-valuenow={scale && number !== null ? Math.max(scale.min, Math.min(scale.max, number)) : undefined}
          aria-valuetext={scale && number !== null ? `${reading.value}${isPercentage ? '%' : reading.unit ? ` ${reading.unit}` : ''}` : undefined}
        >
          <Visualizer value={number} scale={scale} charging={attributes.is_charging === true || attributes.charging === true || state.charging === true} />
          {scale && number !== null && <SensorCompactBar value={number} min={scale.min} max={scale.max} attention={severity === 'low' || severity === 'critical' ? severity : null} />}
          <div className="sensor-analog-readout"><SensorPresentationHero reading={reading} t={t} decimals={heroDecimals} /></div>
        </div> : <SensorPresentationHero reading={reading} t={t} decimals={heroDecimals} />}
      </div>
      {hasStatus && <div className="sensor-reading-footer">
        <div className="sensor-reading-status text-muted-foreground">
          <span className="sensor-status-badge">
            <span className={cn('sensor-status-dot', severity === 'critical' ? 'bg-danger' : 'bg-warning')} aria-hidden="true" />
            <span className="min-w-0">{statusLabel}</span>
          </span>
        </div>
      </div>}
    </div>
  );
}
