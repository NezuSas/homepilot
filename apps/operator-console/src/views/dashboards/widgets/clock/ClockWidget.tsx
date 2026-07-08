import { useEffect, useState } from 'react';
import { CLOCK_DESIGNS } from './clockRegistry';
import type { ClockStyle, ClockWidgetProps } from './clockTypes';

export function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());
  const clockStyle = (config.extra?.clockStyle as ClockStyle) ?? 'minimal';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const ClockDesign = CLOCK_DESIGNS[clockStyle] ?? CLOCK_DESIGNS.minimal;

  return <ClockDesign now={now} config={config} />;
}
