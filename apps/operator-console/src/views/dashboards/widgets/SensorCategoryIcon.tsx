import { Activity, BatteryFull, BatteryLow, BatteryMedium, Droplets, Gauge, MemoryStick, Sun, Thermometer, UserRound, Wifi, Wind, Zap } from 'lucide-react';
import type { SensorCategory } from './sensorReading';

function BatteryIcon({ percentage }: { percentage: number | null }) {
  const iconClassName = 'h-full w-full';
  if (percentage === null || percentage <= 20) return <BatteryLow className={iconClassName} />;
  if (percentage < 60) return <BatteryMedium className={iconClassName} />;
  return <BatteryFull className={iconClassName} />;
}

export function CategoryIcon({ category, percentage }: { category: SensorCategory; percentage: number | null }) {
  const className = 'h-full w-full';
  switch (category) {
    case 'battery': return <BatteryIcon percentage={percentage} />;
    case 'temperature': return <Thermometer className={className} />;
    case 'humidity': return <Droplets className={className} />;
    case 'pressure': return <Gauge className={className} />;
    case 'memory': return <MemoryStick className={className} />;
    case 'load': return <Gauge className={className} />;
    case 'power': return <Zap className={className} />;
    case 'energy': return <Zap className={className} />;
    case 'signal': return <Wifi className={className} />;
    case 'illuminance': return <Sun className={className} />;
    case 'air_quality': return <Wind className={className} />;
    case 'presence': return <UserRound className={className} />;
    case 'measurement': return <Gauge className={className} />;
    default: return <Activity className={className} />;
  }
}
