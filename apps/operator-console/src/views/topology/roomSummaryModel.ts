import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { isPlcIntegration } from '../../../../../packages/devices/domain/integrationCatalog';
import { getRoomDeviceGroup, getRoomDeviceState, ROOM_DEVICE_GROUP_ORDER, type RoomDeviceGroup } from './topologyDeviceControl';
import { countActiveRoomDevices } from './topologyViewModel';

export interface RoomSummary {
  total: number;
  /** Only the kinds the room actually has, in presentation order. */
  groups: { group: RoomDeviceGroup; count: number }[];
  active: number;
  /** True when at least one device reports on/off, so "N on" says something about this room. */
  hasStates: boolean;
  /** Devices that are not answering; never counted as off. */
  unavailable: number;
  /** Half or more of the devices are PLC points: the room is a technical one. */
  mostlyPlc: boolean;
}

/** What a space holds and how it is doing, derived from its devices and never decorative. */
export function buildRoomSummary(devices: SnapshotDevice[]): RoomSummary {
  const counts = new Map<RoomDeviceGroup, number>();
  for (const device of devices) {
    const group = getRoomDeviceGroup(device);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return {
    total: devices.length,
    groups: ROOM_DEVICE_GROUP_ORDER.filter(group => counts.has(group)).map(group => ({ group, count: counts.get(group) ?? 0 })),
    active: countActiveRoomDevices(devices),
    hasStates: devices.some(device => getRoomDeviceGroup(device) !== 'action' && getRoomDeviceState(device) !== null),
    unavailable: devices.filter(isDeviceUnavailable).length,
    mostlyPlc: devices.length > 0 && devices.filter(device => isPlcIntegration(device.integrationSource)).length * 2 >= devices.length,
  };
}

/** Passive or incidental kinds do not say what a space is; they only decide when nothing else is there. */
const SUPPORTING_GROUPS: readonly RoomDeviceGroup[] = ['sensor', 'action', 'other'];

/** Which icon identifies a space at a glance: technical rooms first, then what it mostly holds. */
export type RoomIconKey = 'plc' | RoomDeviceGroup | 'empty';

export function roomIconKey(summary: RoomSummary): RoomIconKey {
  if (summary.total === 0) return 'empty';
  if (summary.mostlyPlc) return 'plc';
  const leading = summary.groups.filter(entry => !SUPPORTING_GROUPS.includes(entry.group));
  const [first] = [...(leading.length > 0 ? leading : summary.groups)].sort((left, right) => right.count - left.count
    || ROOM_DEVICE_GROUP_ORDER.indexOf(left.group) - ROOM_DEVICE_GROUP_ORDER.indexOf(right.group));
  return first.group;
}
