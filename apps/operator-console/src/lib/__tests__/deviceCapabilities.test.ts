import { canExecuteCommand, getCapability, getRoutineDeviceCommands, hasCapability, isCameraDevice } from '../deviceCapabilities';
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

  it('excludes cameras by physical or semantic identity without hiding other device kinds', () => {
    expect(isCameraDevice({ type: 'camera' })).toBe(true);
    expect(isCameraDevice({ type: 'switch', semanticType: 'camera' })).toBe(true);
    for (const type of ['light', 'switch', 'outlet', 'sensor', 'cover', 'unknown']) {
      expect(isCameraDevice({ type })).toBe(false);
    }
  });

  it('uses real momentary commands even when a button is labeled as a light', () => {
    const action = { ...device([{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }]), type: 'button', semanticType: 'light' as const };
    expect(getRoutineDeviceCommands(action)).toEqual(['press']);
    expect(getRoutineDeviceCommands({ ...action, capabilities: [{ type: 'scene', name: 'Scene', commands: [{ name: 'activate' }] }] })).toEqual(['activate']);
    expect(getRoutineDeviceCommands({ ...action, type: 'sensor', capabilities: [{ type: 'scene', name: 'Scene', commands: [{ name: 'activate' }] }] })).toEqual(['activate']);
  });

  it('keeps real power commands and rejects commandless sensors or cameras', () => {
    expect(getRoutineDeviceCommands(device([{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }, { name: 'turn_off' }] }]))).toEqual(['turn_on', 'turn_off']);
    expect(getRoutineDeviceCommands({ ...device([{ type: 'sensor', name: 'Sensor', commands: [] }]), type: 'sensor', semanticType: 'light' })).toEqual([]);
    expect(getRoutineDeviceCommands({ ...device(), type: 'sensor', semanticType: 'light', capabilities: undefined })).toEqual([]);
    expect(getRoutineDeviceCommands({ ...device([{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }]), type: 'camera' })).toEqual([]);
  });
});
