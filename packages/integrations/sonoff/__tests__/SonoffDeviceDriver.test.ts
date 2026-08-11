import { Device } from '../../../devices/domain/types';
import { SonoffConnectionRegistry } from '../application/SonoffLanDiscoveryService';
import { SonoffDeviceDriver } from '../infrastructure/SonoffDeviceDriver';

const device: Device = {
  id: 'sonoff-device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'sonoff:eWeLink_abc123', name: 'Switch', type: 'switch', vendor: 'Sonoff', status: 'ASSIGNED', integrationSource: 'sonoff', invertState: false, lastKnownState: { on: false }, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Feature: Sonoff local command driver', () => {
  const driver = new SonoffDeviceDriver();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('Scenario: Given a reachable Sonoff switch When it is turned on Then the verified local state is returned', async () => {
    SonoffConnectionRegistry.registerIp('eWeLink_abc123', '192.168.1.25');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ data: { switch: 'on' } }) }) as unknown as typeof fetch;

    const result = await driver.executeCommand(device, { name: 'turn_on' }, { userId: 'operator-1', correlationId: 'test-command' });

    expect(result).toEqual({ success: true, newState: { on: true, state: 'on' } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('Scenario: Given an unsupported command When it is sent to Sonoff Then no LAN request is made', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await driver.executeCommand(device, { name: 'set_position' }, { userId: 'operator-1', correlationId: 'test-command' });

    expect(result.success).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});