import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

export function isDeviceUnavailable(device: SnapshotDevice): boolean {
  return device.lastKnownState?.state === 'unavailable';
}
