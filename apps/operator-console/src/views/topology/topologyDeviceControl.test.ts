import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { getRoomDeviceCommand, getRoomDeviceState, isRoomDeviceMomentary, sortRoomDevices } from './topologyDeviceControl';

const device = (extra: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id: 'light', homeId: 'home', roomId: 'room', name: 'Luz', type: 'light', status: 'ASSIGNED', lastKnownState: { on: false }, ...extra,
});

describe('Room device control (AC16, AC25)', () => {
  it('uses real momentary capabilities even when a sensor is labeled as light', () => {
    const action = device({ type: 'sensor', semanticType: 'light', capabilities: [{ type: 'button', name: 'Action', commands: [{ name: 'press' }] }] });
    expect(getRoomDeviceCommand(action)).toBe('press');
    expect(isRoomDeviceMomentary(action)).toBe(true);
  });
  it('supports imported scene activation without inventing an on/off command', () => {
    expect(getRoomDeviceCommand(device({ capabilities: [{ type: 'scene', name: 'Scene', commands: [{ name: 'activate' }] }] }))).toBe('activate');
  });
  it('uses the compatible stateful command and respects inverted states', () => {
    expect(getRoomDeviceCommand(device())).toBe('turn_on');
    expect(getRoomDeviceCommand(device({ lastKnownState: { state: 'on' } }))).toBe('turn_off');
    expect(getRoomDeviceCommand(device({ invertState: true }))).toBe('turn_off');
    expect(getRoomDeviceCommand(device({ capabilities: [{ type: 'switch', name: 'Switch', commands: [{ name: 'toggle' }] }] }))).toBe('toggle');
  });
  it.each([null, {}, { state: 'unknown' }, { state: 'unavailable' }, { state: 'offline' }])('does not show missing state %j as off', lastKnownState => {
    const unknown = device({ type: 'sensor', lastKnownState });
    expect(getRoomDeviceState(unknown)).toBeNull();
    expect(getRoomDeviceCommand(unknown)).toBeNull();
  });
  it('does not expose commands for cameras, pending or unavailable devices', () => {
    expect(getRoomDeviceCommand(device({ type: 'camera' }))).toBeNull();
    expect(getRoomDeviceCommand(device({ status: 'PENDING' }))).toBeNull();
    expect(getRoomDeviceCommand(device({ lastKnownState: { state: 'unavailable' } }))).toBeNull();
  });
  it('sorts all types alphabetically without moving cards when state changes', () => {
    const devices = [device({ name: 'Zeta', id: 'z' }), device({ name: 'Alfa', id: 'a', type: 'sensor' })];
    expect(sortRoomDevices(devices, '').map(item => item.id)).toEqual(['a', 'z']);
    devices[0].lastKnownState = { on: true };
    expect(sortRoomDevices(devices, '').map(item => item.id)).toEqual(['a', 'z']);
    expect(sortRoomDevices(devices, 'ALF').map(item => item.id)).toEqual(['a']);
    expect(devices[0].id).toBe('z');
  });
});
