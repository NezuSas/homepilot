import { SensorLevelGauge, type SensorVisualizerProps } from './SensorLevelGauge';
export function SensorThermometer(props: SensorVisualizerProps) {
  return <SensorLevelGauge {...props} vessel="thermometer" />;
}
