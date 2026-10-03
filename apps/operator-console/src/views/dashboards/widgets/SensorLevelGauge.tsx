import { formatSensorGaugeTick, sensorNeedleFraction, type SensorGaugeScale } from './SensorAnalogGauge';

export interface SensorVisualizerProps { value: number | null; scale: SensorGaugeScale | null; charging?: boolean }

/** Shared liquid system: only the vessel changes, never the reading or scale. */
export function SensorLevelGauge({ value, scale, charging = false, vessel = 'level' }: SensorVisualizerProps & { vessel?: 'level' | 'battery' | 'thermometer' }) {
  const tankClipId = useId();
  const fraction = value !== null && scale ? sensorNeedleFraction(value, scale) : null;
  if (vessel === 'level') {
    const surfaceY = 201 - (fraction ?? 0) * 157;
    return <svg viewBox="0 0 320 265" className="sensor-analog-canvas sensor-liquid-instrument" aria-hidden="true" data-sensor-visualizer="level" data-level={fraction ?? undefined}>
      <defs><clipPath id={tankClipId}><path d="M76 44C76 22 224 22 224 44V201C224 223 76 223 76 201Z" /></clipPath></defs>
      <path data-sensor-level-tank d="M76 44C76 22 224 22 224 44V201C224 223 76 223 76 201Z" className="sensor-vessel" />
      <g clipPath={`url(#${tankClipId})`}>
        <ellipse cx="150" cy="201" rx="70" ry="12" className="sensor-liquid" style={{ visibility: fraction === null || fraction === 0 ? 'hidden' : undefined }} />
        <svg x="80" y="44" width="140" height="157" viewBox="0 0 140 157">
          <rect y="0" width="140" height="157" className="sensor-liquid" style={{ transform: `scaleY(${fraction ?? 0})`, visibility: fraction === null ? 'hidden' : undefined }} />
        </svg>
        <ellipse data-sensor-level-surface cx="150" cy="0" rx="70" ry="10" className="sensor-liquid-surface" style={{ transform: `translateY(${surfaceY}px)`, visibility: fraction === null || fraction === 0 ? 'hidden' : undefined }} />
      </g>
      <ellipse cx="150" cy="44" rx="74" ry="13" className="sensor-tank-rim" />
      <path d="M76 201C76 223 224 223 224 201" className="sensor-tank-rim" />
      {scale && [0, .25, .5, .75, 1].map(step => <g key={step} className="sensor-liquid-tick">
        <path d={`M232 ${201 - step * 157}h6`} />
        <text x="246" y={206 - step * 157}>{formatSensorGaugeTick(scale.min + step * (scale.max - scale.min))}</text>
      </g>)}
    </svg>;
  }
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
import { useId } from 'react';
