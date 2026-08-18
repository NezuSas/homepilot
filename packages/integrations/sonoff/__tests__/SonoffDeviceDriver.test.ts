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
  it('supports only Sonoff devices and rejects malformed or unaddressable targets before transport', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    expect(driver.supports(device)).toBe(true);
    expect(driver.supports({ ...device, integrationSource: 'native' })).toBe(false);
    await expect(driver.executeCommand({ ...device, externalId: 'edge:bad' }, { name: 'turn_on' }, { userId: 'operator-1', correlationId: 'test' }))
      .resolves.toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('ExternalId') }));
    await expect(driver.executeCommand({ ...device, externalId: 'sonoff:unknown-device', lastKnownState: null }, { name: 'turn_on' }, { userId: 'operator-1', correlationId: 'test' }))
      .resolves.toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Dirección IP') }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses a remembered IP, retries a failed dispatch once, and preserves optimistic state when verification is unavailable', async () => {
    const retryingDevice = { ...device, externalId: 'sonoff:eWeLink_retry', lastKnownState: { on: true, brightness: 80, power: 1, ip: '192.168.1.28' } };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('verification timed out')) as unknown as typeof fetch;

    const result = await driver.executeCommand(retryingDevice, { name: 'toggle' }, { userId: 'operator-1', correlationId: 'test-command' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true, newState: { on: false, brightness: 0, power: 0, ip: '192.168.1.28', state: 'off' } });
  });

  it('clears command and verification timers when the LAN transport rejects', async () => {
    jest.useFakeTimers();
    SonoffConnectionRegistry.registerIp('eWeLink_timer-cleanup', '192.168.1.31');
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch;

    try {
      await expect(driver.executeCommand(
        { ...device, externalId: 'sonoff:eWeLink_timer-cleanup' },
        { name: 'turn_off' },
        { userId: 'operator-1', correlationId: 'test-command' },
      )).resolves.toEqual({ success: false, error: 'connection refused' });

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it('returns the transport error after the retry budget is exhausted', async () => {
    SonoffConnectionRegistry.registerIp('eWeLink_failure', '192.168.1.29');
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch;

    const result = await driver.executeCommand({ ...device, externalId: 'sonoff:eWeLink_failure' }, { name: 'turn_off' }, { userId: 'operator-1', correlationId: 'test-command' });

    expect(result).toEqual({ success: false, error: 'connection refused' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});