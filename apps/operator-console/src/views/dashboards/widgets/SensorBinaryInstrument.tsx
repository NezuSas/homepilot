import { cn } from '../../../lib/utils';
import type { SensorReading } from './sensorReading';

export function SensorBinaryInstrument({ reading, t }: { reading: SensorReading; t: (key: string) => string }) {
  return (
    <div data-sensor-visualizer="switch" className="sensor-binary-instrument flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-2">
      <div role="img" aria-label={reading.binaryState ? t(`dashboard.editor.sections.sensor_${reading.binaryState}`) : t('dashboard.editor.sections.sensor_unavailable')}
        className={cn('sensor-binary-track flex h-12 w-24 max-w-full items-center rounded-full border p-1', reading.binaryState === 'on' ? 'justify-end border-success/60 bg-success/15 text-success' : reading.binaryState === 'off' ? 'justify-start border-danger/60 bg-danger/15 text-danger' : 'justify-center border-border bg-muted text-muted-foreground')}>
        <span className="sensor-binary-thumb grid size-9 place-items-center rounded-full bg-current"><span className="text-xs font-bold text-background">{reading.binaryState === 'on' ? 'ON' : reading.binaryState === 'off' ? 'OFF' : '—'}</span></span>
      </div>
      <span className={cn('sensor-binary-caption text-caption font-semibold', !reading.binaryState && 'sensor-binary-caption-unavailable')}>{reading.binaryState ? t(`dashboard.editor.sections.sensor_${reading.binaryState}`) : t('dashboard.editor.sections.sensor_unavailable')}</span>
    </div>
  );
}
