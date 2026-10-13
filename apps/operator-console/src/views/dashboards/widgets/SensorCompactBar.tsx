import { cn } from '../../../lib/utils';

interface SensorCompactBarProps {
  value: number;
  min: number;
  max: number;
  /** Colour the fill only when the reading needs attention; otherwise it stays in the brand colour. */
  attention: 'low' | 'critical' | null;
}

/**
 * A slim bar that stands in for the dial on small cards, so a one-cell sensor still shows at a glance
 * where its reading sits in its range. Large cards keep the dial and never show it (see index.css).
 */
export function SensorCompactBar({ value, min, max, attention }: SensorCompactBarProps) {
  const span = max - min;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0;
  return (
    <div aria-hidden="true" data-sensor-compact-bar="" className="sensor-compact-bar">
      <span
        className={cn('sensor-compact-bar-fill', attention === 'critical' ? 'bg-danger' : attention === 'low' ? 'bg-warning' : 'bg-primary')}
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  );
}
