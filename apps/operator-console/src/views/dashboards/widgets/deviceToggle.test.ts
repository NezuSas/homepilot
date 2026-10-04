import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { createDeviceTogglePlan, executeDeviceToggle } from './deviceToggle';
import { isDeviceActive } from '../dashboardUtils';

function createDevice(overrides: Partial<SnapshotDevice> = {}): SnapshotDevice {
  return {
    id: 'light-1',
    homeId: 'home-1',
    roomId: 'room-1',
    name: 'Sala',
    type: 'light',
    status: 'ASSIGNED',
    lastKnownState: { state: 'off' },
    capabilities: [{
      type: 'light',
      name: 'Light',
      commands: [{ name: 'turn_on' }, { name: 'turn_off' }],
    }],
    ...overrides,
  };
}

describe('dashboard device toggle', () => {
  it.each([[false, true, 'turn_on'], [true, false, 'turn_off']] as const)('Scenario: Command %s controls an output displaying physical %s (AC38)', (commandState, physicalState, command) => {
    const device = createDevice({ integrationSource: 'modbus-tcp', lastKnownState: { plcRole: 'output', commandState, physicalState, actualState: physicalState, value: physicalState, state: physicalState ? 'on' : 'off', available: true } });
    const plan = createDeviceTogglePlan(device);
    expect(plan?.command).toBe(command);
    expect(isDeviceActive(device)).toBe(physicalState);
    expect(isDeviceActive(plan!.optimisticDevice)).toBe(physicalState);
    expect(plan?.optimisticDevice.lastKnownState?.commandState).toBe(commandState);
    expect(plan?.optimisticDevice.lastKnownState?.commandedState).toBe(!commandState);
    expect(createDeviceTogglePlan({ ...device, lastKnownState: { ...device.lastKnownState, stale: true } })).toBeNull();
  });
  it('Scenario: Configured feedback controls retain their behavior (AC38)', () => {
    const device = createDevice({ integrationSource: 'modbus-tcp', lastKnownState: { plcRole: 'output', commandState: false, feedbackState: true, state: 'on' } });
    expect(createDeviceTogglePlan(device)?.command).toBe('turn_off');
  });
  it('selects a pressed button state and command for a supported card tap', () => {
    const plan = createDeviceTogglePlan(createDevice());

    expect(plan).toEqual(expect.objectContaining({ command: 'turn_on', isActive: true }));
    expect(plan?.isActive).toBe(true);
    expect(isDeviceActive(plan!.optimisticDevice)).toBe(true);
  });

  it('applies the optimistic device immediately and reconciles it from the command response', async () => {
    const device = createDevice();
    const serverDevice = createDevice({ lastKnownState: { state: 'on', brightness: 68 } });
    const upsertDevice = jest.fn();

    const result = await executeDeviceToggle(device, {
      upsertDevice,
      sendCommand: async (command) => {
        expect(command).toBe('turn_on');
        return serverDevice;
      },
    });

    expect(result.succeeded).toBe(true);
    expect(upsertDevice).toHaveBeenNthCalledWith(1, expect.objectContaining({
      id: device.id,
      lastKnownState: expect.objectContaining({ state: 'on' }),
    }));
    expect(upsertDevice).toHaveBeenLastCalledWith(serverDevice);
  });

  it('rolls back the exact snapshot when a command fails', async () => {
    const device = createDevice({ lastKnownState: { state: 'on', brightness: 24 } });
    const upsertDevice = jest.fn();

    const result = await executeDeviceToggle(device, {
      upsertDevice,
      sendCommand: async () => {
        throw new Error('DEVICE_COMMAND_FAILED');
      },
    });

    expect(result.succeeded).toBe(false);
    expect(upsertDevice).toHaveBeenNthCalledWith(1, expect.objectContaining({
      lastKnownState: expect.objectContaining({ state: 'off', brightness: 0 }),
    }));
    expect(upsertDevice).toHaveBeenLastCalledWith(device);
  });

  it('uses the backend-declared toggle command when direct on/off commands are unavailable', () => {
    const plan = createDeviceTogglePlan(createDevice({
      capabilities: [{ type: 'switch', name: 'Switch', commands: [{ name: 'toggle' }] }],
    }));

    expect(plan?.command).toBe('toggle');
    expect(plan?.isActive).toBe(true);
  });
});
