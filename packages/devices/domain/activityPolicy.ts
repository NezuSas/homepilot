/**
 * Numeric telemetry (CPU load, memory, temperatures) changes many times a minute and nothing reads its history
 * from the activity log: the current value already lives on the device. Recording it only fills the disk.
 * Every other kind of device, binary sensors included, keeps its state changes in the log.
 */
export function recordsStateChange(deviceType: string): boolean {
  return deviceType.trim().toLowerCase() !== 'sensor';
}
