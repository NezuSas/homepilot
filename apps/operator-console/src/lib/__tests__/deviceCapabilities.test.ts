import { canExecuteCommand, getCapability, hasCapability } from '../deviceCapabilities';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';

function device(capabilities?: SnapshotDevice['capabilities']): SnapshotDevice {
  return {
    id: 'device-1',
    homeId: 'home-1',
    roomId: null,
    name: 'Device',
    type: 'light',
    status: 'ASSIGNED',
    lastKnownState: null,
    capabilities
  };
}

describe('deviceCapabilities', () => {
  it('finds capabilities and reports their presence', () => {
    const target = device([{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }] }]);

    expect(getCapability(target, 'light')).toEqual(expect.objectContaining({ name: 'Light' }));
    expect(getCapability(target, 'cover')).toBeUndefined();
    expect(hasCapability(target, 'light')).toBe(true);
    expect(hasCapability(target, 'cover')).toBe(false);
  });

  it('uses the conservative legacy command allow-list only without declared capabilities', () => {
    expect(canExecuteCommand(device(), 'turn_on')).toBe(true);
    expect(canExecuteCommand(device([]), 'open')).toBe(true);
    expect(canExecuteCommand(device(), 'set_position')).toBe(false);
  });

  it('uses backend-declared commands strictly when capabilities exist', () => {
    const target = device([
      { type: 'light', name: 'Light', commands: [{ name: 'turn_on' }] },
      { type: 'sensor', name: 'Sensor' },
      { type: 'cover', name: 'Cover', commands: [] }
    ]);

    expect(canExecuteCommand(target, 'turn_on')).toBe(true);
    expect(canExecuteCommand(target, 'turn_off')).toBe(false);
  });
});
