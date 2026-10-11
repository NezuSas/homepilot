import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { canExecuteCommand } from '../../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { getRoomDeviceState, isRoomDeviceMomentary } from './topologyDeviceControl';
import type { TopologyHome } from './topologyPresentation';

/** Only the owner of a home may create, rename or delete its spaces. */
export function canManageHome(home: TopologyHome | null, userId: string | undefined): boolean {
  return home !== null && home.ownerId === userId;
}

/** Devices assigned to the given room of the given home. */
export function getAssignedRoomDevices(
  devices: SnapshotDevice[],
  roomId: string | null,
  homeId: string | undefined,
): SnapshotDevice[] {
  if (roomId === null) return [];
  return devices.filter((device) => device.roomId === roomId && device.homeId === homeId && device.status === 'ASSIGNED');
}

export function countActiveRoomDevices(devices: SnapshotDevice[]): number {
  return devices.filter(device => !isRoomDeviceMomentary(device) && getRoomDeviceState(device) === true).length;
}

/** A command may only run on an assigned, reachable device of the selected room. */
export function canRunRoomDeviceCommand(
  device: SnapshotDevice | undefined,
  command: string,
  selectedRoomId: string | null,
  homeId: string | undefined,
): device is SnapshotDevice {
  return device !== undefined
    && device.roomId === selectedRoomId
    && device.homeId === homeId
    && device.status === 'ASSIGNED'
    && !isDeviceUnavailable(device)
    && canExecuteCommand(device, command);
}

/** Devices of a deleted room go back to the pending inbox. */
export function detachRoomDevices(devices: SnapshotDevice[], roomId: string): SnapshotDevice[] {
  return devices.map((device) => (
    device.roomId === roomId ? { ...device, roomId: null, status: 'PENDING' } : device
  ));
}
