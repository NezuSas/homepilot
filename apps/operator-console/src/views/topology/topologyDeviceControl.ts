import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { getRoutineDeviceCommands, isCameraDevice } from '../../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { resolveManagedDeviceKind, type ManagedDeviceKind } from '../../lib/devicePresentation';

export type RoomDeviceGroup = ManagedDeviceKind | 'media_player';

export function getRoomDeviceGroup(device: SnapshotDevice): RoomDeviceGroup {
  const kind = resolveManagedDeviceKind(device);
  if (kind === 'other' && (device.type === 'media_player' || device.profile?.domain === 'media_player'
    || device.capabilities?.some(capability => capability.type === 'media_player'))) return 'media_player';
  return kind;
}

const ROOM_DEVICE_GROUP_ORDER: RoomDeviceGroup[] = ['light', 'switch', 'cover', 'media_player', 'sensor', 'smart_display', 'camera', 'other'];

/** Null means unknown, not off. Momentary commands never acquire a toggle state. */
export function getRoomDeviceState(device: SnapshotDevice): boolean | null {
  const state = device.lastKnownState;
  if (!state || isDeviceUnavailable(device) || ['unknown', 'offline'].includes(String(state.state))) return null;
  let active: boolean | null = null;
  if (typeof state.on === 'boolean') active = state.on;
  else if (state.state === 'on' || state.state === 'off') active = state.state === 'on';
  else if (typeof state.brightness === 'number') active = state.brightness > 0;
  return active === null ? null : device.invertState ? !active : active;
}

export function getRoomDeviceCommand(device: SnapshotDevice): string | null {
  if (device.status !== 'ASSIGNED' || isDeviceUnavailable(device) || isCameraDevice(device)) return null;
  const commands = getRoutineDeviceCommands(device);
  const momentary = commands.find(command => command === 'press' || command === 'activate');
  if (momentary) return momentary;
  const active = getRoomDeviceState(device);
  if (active === null) return commands.includes('toggle') ? 'toggle' : null;
  const command = active ? 'turn_off' : 'turn_on';
  return commands.includes(command) ? command : commands.includes('toggle') ? 'toggle' : null;
}

export function isRoomDeviceMomentary(device: SnapshotDevice): boolean {
  return getRoutineDeviceCommands(device).some(command => command === 'press' || command === 'activate');
}

export function sortRoomDevices(devices: SnapshotDevice[], search: string): SnapshotDevice[] {
  const query = search.trim().toLocaleLowerCase();
  return devices.filter(device => !query || device.name.toLocaleLowerCase().includes(query))
    .sort((left, right) => ROOM_DEVICE_GROUP_ORDER.indexOf(getRoomDeviceGroup(left)) - ROOM_DEVICE_GROUP_ORDER.indexOf(getRoomDeviceGroup(right))
      || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}
