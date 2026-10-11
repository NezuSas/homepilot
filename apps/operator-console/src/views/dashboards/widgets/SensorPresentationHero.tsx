import type { CSSProperties } from 'react';
import { cn } from '../../../lib/utils';
import { CategoryIcon } from './SensorCategoryIcon';
import { displayValue, formatSensorValue } from './sensorDisplay';
import { numericValue, type SensorReading } from './sensorReading';

export function SensorPresentationHero({ reading, t, decimals = false }: {
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
  const readingScale = value.length > 6 ? Math.min(12, 70 / readingWidth) : 12;
  const isState = available && (reading.presentation === 'binary' || reading.presentation === 'categorical');

  return (
    <>
      {isState ? <span aria-hidden="true" className={cn('sensor-state-symbol', reading.binaryState === 'off' && 'sensor-state-symbol-idle')}><CategoryIcon category={reading.category} percentage={reading.percentage} /></span> : null}
      <span className="sensor-reading-value" style={{ '--sensor-reading-scale': `${readingScale}cqi` } as CSSProperties}>
        <span className={cn('sensor-reading-number tabular-nums tracking-tight', !available && 'text-muted-foreground', isState && 'sensor-reading-state', available && numericValue(reading.value) !== null && value.length > 6 && 'sensor-reading-plain')}>
          {value}
        </span>
        {available && unit ? <span className="sensor-reading-unit font-medium text-muted-foreground">{unit}</span> : null}
        {!available && <span className="text-xs text-muted-foreground">{t('dashboard.editor.sections.sensor_unavailable')}</span>}
      </span>
    </>
  );
}
