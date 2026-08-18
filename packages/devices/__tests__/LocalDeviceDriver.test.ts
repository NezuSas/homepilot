import { LocalDeviceDriver } from '../infrastructure/drivers/LocalDeviceDriver';
import { Device } from '../domain/types';

const device = (integrationSource: string, lastKnownState: Record<string, unknown> | null = { on: false, label: 'Kitchen' }): Device => ({
  id: 'local-light-1',
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: 'local-light-1',
  name: 'Kitchen light',
  type: 'light',
  vendor: 'HomePilot',
  status: 'ASSIGNED',
  integrationSource,
  invertState: false,
  lastKnownState,
  entityVersion: 1,
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:00.000Z'
});

const context = { userId: 'user-1', correlationId: 'correlation-1' };

describe('LocalDeviceDriver', () => {
  const driver = new LocalDeviceDriver();

  it('supports only local integration devices', () => {
    expect(driver.supports(device('local'))).toBe(true);
    expect(driver.supports(device('home-assistant'))).toBe(false);
  });

  it.each([
    ['turn_on', { on: true, state: 'on', label: 'Kitchen' }],
    ['turn_off', { on: false, state: 'off', label: 'Kitchen' }],
    ['toggle', { on: true, state: 'on', label: 'Kitchen' }]
  ] as const)('applies %s without mutating the device state', async (name, expectedState) => {
    const source = device('local');
    const result = await driver.executeCommand(source, { name }, context);

    expect(result).toEqual({ success: true, newState: expectedState });
    expect(source.lastKnownState).toEqual({ on: false, label: 'Kitchen' });
  });

  it('toggles an active device off and leaves unsupported commands unchanged', async () => {
    const active = device('local', { on: true, state: 'on' });

    await expect(driver.executeCommand(active, { name: 'toggle' }, context)).resolves.toEqual({
      success: true,
      newState: { on: false, state: 'off' }
    });
    await expect(driver.executeCommand(device('local', null), { name: 'open' }, context)).resolves.toEqual({
      success: true,
      newState: {}
    });
  });
});