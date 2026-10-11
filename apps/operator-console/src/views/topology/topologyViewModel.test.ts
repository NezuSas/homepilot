import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import {
  canManageHome,
  canRunRoomDeviceCommand,
  countActiveRoomDevices,
  detachRoomDevices,
  getAssignedRoomDevices,
} from './topologyViewModel';

const device = (extra: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id: 'light', homeId: 'home', roomId: 'room', name: 'Luz', type: 'light', status: 'ASSIGNED', lastKnownState: { on: false }, ...extra,
});

describe('topologyViewModel', () => {
  it('lets only the owner manage a home', () => {
    const home = { id: 'home', name: 'Casa', ownerId: 'owner' };
    expect(canManageHome(home, 'owner')).toBe(true);
    expect(canManageHome(home, 'other')).toBe(false);
    expect(canManageHome(home, undefined)).toBe(false);
    expect(canManageHome(null, 'owner')).toBe(false);
  });

  it('selects only assigned devices of the room and home', () => {
    const devices = [
      device({ id: 'a' }),
      device({ id: 'b', roomId: 'other' }),
      device({ id: 'c', homeId: 'elsewhere' }),
      device({ id: 'd', status: 'PENDING' }),
    ];
    expect(getAssignedRoomDevices(devices, 'room', 'home').map(item => item.id)).toEqual(['a']);
    expect(getAssignedRoomDevices(devices, null, 'home')).toEqual([]);
  });

  it('counts active stateful devices and ignores momentary ones', () => {
    const devices = [
      device({ id: 'on', lastKnownState: { on: true } }),
      device({ id: 'off', lastKnownState: { on: false } }),
      device({ id: 'press', type: 'sensor', capabilities: [{ type: 'button', name: 'Action', commands: [{ name: 'press' }] }], lastKnownState: { on: true } }),
    ];
    expect(countActiveRoomDevices(devices)).toBe(1);
  });

  it('gates room commands by room, home, status, availability and capability', () => {
    expect(canRunRoomDeviceCommand(device(), 'turn_on', 'room', 'home')).toBe(true);
    expect(canRunRoomDeviceCommand(undefined, 'turn_on', 'room', 'home')).toBe(false);
    expect(canRunRoomDeviceCommand(device(), 'turn_on', 'other', 'home')).toBe(false);
    expect(canRunRoomDeviceCommand(device(), 'turn_on', 'room', 'elsewhere')).toBe(false);
    expect(canRunRoomDeviceCommand(device({ status: 'PENDING' }), 'turn_on', 'room', 'home')).toBe(false);
    expect(canRunRoomDeviceCommand(device({ lastKnownState: { state: 'unavailable' } }), 'turn_on', 'room', 'home')).toBe(false);
  });

  it('sends devices of a deleted room back to pending', () => {
    const result = detachRoomDevices([device({ id: 'a' }), device({ id: 'b', roomId: 'other' })], 'room');
    expect(result[0]).toMatchObject({ roomId: null, status: 'PENDING' });
    expect(result[1]).toMatchObject({ roomId: 'other', status: 'ASSIGNED' });
  });
});
