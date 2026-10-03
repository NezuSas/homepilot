import { formatSensorGaugeTick, sensorNeedleFraction, type SensorGaugeScale } from './SensorAnalogGauge';

export interface SensorVisualizerProps { value: number | null; scale: SensorGaugeScale | null; charging?: boolean }

/** Shared liquid system: only the vessel changes, never the reading or scale. */
export function SensorLevelGauge({ value, scale, charging = false, vessel = 'level' }: SensorVisualizerProps & { vessel?: 'level' | 'battery' | 'thermometer' }) {
  const fraction = value !== null && scale ? sensorNeedleFraction(value, scale) : null;
  const narrow = vessel === 'thermometer';
  const x = narrow ? 139 : 108;
  const width = narrow ? 42 : 104;
  return <svg viewBox="0 0 320 265" className="sensor-analog-canvas sensor-liquid-instrument" aria-hidden="true" data-sensor-visualizer={vessel} data-level={fraction ?? undefined}>
    {vessel === 'battery' && <rect x="141" y="18" width="38" height="13" rx="4" className="sensor-vessel" />}
    <rect x={x} y="32" width={width} height="169" rx={narrow ? 21 : 16} className="sensor-vessel" />
    <svg x={x + 6} y="38" width={width - 12} height="157" viewBox={`0 0 ${width - 12} 157`}>
      <rect width={width - 12} height="157" rx={narrow ? 15 : 10} className="sensor-liquid" style={{ transform: `scaleY(${fraction ?? 0})`, visibility: fraction === null ? 'hidden' : undefined }} />
    </svg>
    {narrow && <circle cx="160" cy="203" r="23" className={fraction === null ? 'sensor-vessel' : 'sensor-liquid-bulb'} />}
    {vessel === 'battery' && charging && fraction !== null && <path data-battery-charging d="M166 89l-22 33h15l-5 23 22-33h-15z" fill="currentColor" />}
    {scale && [0, .25, .5, .75, 1].map(step => <g key={step} className="sensor-liquid-tick">
      <path d={`M${x + width + 8} ${195 - step * 157}h6`} />
      <text x={x + width + 20} y={200 - step * 157}>{formatSensorGaugeTick(scale.min + step * (scale.max - scale.min))}</text>
    </g>)}
  </svg>;
}
