import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';

/**
 * Determinates if a device is "Active" (ON, OPEN, or has BRIGHTNESS/VALUE)
 * based on the core system logic.
 */
export function isDeviceActive(device: SnapshotDevice): boolean {
  if (!device.lastKnownState) return false;
  
  const state = device.lastKnownState as Record<string, unknown>;
  
  // Power states
  if (state.on === true || state.state === 'on') return true;
  
  // Security/Proximity states
  if (state.open === true || state.isActive === true) return true;
  
  // Analog states
  if (typeof state.brightness === 'number' && state.brightness > 0) return true;
  if (typeof state.level === 'number' && state.level > 0) return true;
  
  return false;
}

/**
 * Filter devices by room ID.
 */
export function getDevicesInRoom(devices: SnapshotDevice[], roomId: string | null): SnapshotDevice[] {
  if (!roomId) return [];
  return devices.filter(d => d.roomId === roomId);
}
