import { SensorLevelGauge, type SensorVisualizerProps } from './SensorLevelGauge';
export function SensorBatteryGauge(props: SensorVisualizerProps) {
  return <SensorLevelGauge {...props} vessel="battery" />;
}
