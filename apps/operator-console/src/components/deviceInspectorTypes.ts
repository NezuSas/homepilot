import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

export type InspectableDevice = Device & { externalId: string };
export type DeviceCommand = 'turn_on' | 'turn_off' | 'toggle' | 'open' | 'close' | 'stop';

export interface ActivityLog {
  timestamp: string;
  deviceId: string;
  type: string;
  description: string;
  data: Record<string, unknown>;
}
