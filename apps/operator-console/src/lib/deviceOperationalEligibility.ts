import type { AssistantFinding } from '../stores/useAssistantStore';

interface AssignedDevice { id: string; roomId?: string | null; homeId?: string }
interface AssignedRoom { id: string; homeId?: string }

/** A UI projection only: discovery, inventory and saved bindings keep their original data. */
export function isDeviceOperational(device: AssignedDevice, rooms: readonly AssignedRoom[]): boolean {
  return !!device.roomId && rooms.some(room => room.id === device.roomId
    && (!device.homeId || !room.homeId || device.homeId === room.homeId));
}

export function isFindingOperational(finding: AssistantFinding, devices: readonly AssignedDevice[], rooms: readonly AssignedRoom[]): boolean {
  // Inventory findings guide configuration, not use. In particular, keep missing-room alerts.
  if (['new_device_available', 'device_missing_room', 'device_name_technical', 'device_name_duplicate'].includes(finding.type)) return true;
  const ids = new Set<string>();
  if (finding.relatedEntityType === 'device' && finding.relatedEntityId) ids.add(finding.relatedEntityId);
  if (finding.relatedEntityType === 'room' && !rooms.some(room => room.id === finding.relatedEntityId)) return false;
  for (const source of [finding.metadata, ...finding.actions.map(action => action.payload ?? {})]) {
    for (const key of ['deviceId', 'targetDeviceId', 'triggerDeviceId']) {
      if (typeof source[key] === 'string') ids.add(source[key]);
    }
    if (Array.isArray(source.deviceIds)) for (const id of source.deviceIds) if (typeof id === 'string') ids.add(id);
    if (typeof source.roomId === 'string' && !rooms.some(room => room.id === source.roomId)) return false;
  }
  return [...ids].every(id => devices.some(device => device.id === id && isDeviceOperational(device, rooms)));
}
