import { Device } from '../../../devices/domain/types';
import { SonoffConnectionRegistry, SonoffLanDiscoveryService } from '../application/SonoffLanDiscoveryService';

/**
 * A Sonoff device that stops answering local polls used to remain "available"
 * forever (the poll failure was silently swallowed), so bulk assistant actions
 * kept retrying it and reporting "fetch failed" on every single run. This suite
 * covers the fix: after enough consecutive failed polls the device is marked
 * unavailable, and a single successful poll clears that mark again.
 */
describe('SonoffLanDiscoveryService - poll failure reachability tracking', () => {
  const originalFetch = global.fetch;
  let device: Device;
  let deviceRepository: any;
  let syncDeps: any;
  let service: SonoffLanDiscoveryService;

  beforeEach(() => {
    device = {
      id: 'dev-1', homeId: 'home-1', roomId: 'room-1', externalId: 'sonoff:eWeLink_1000f28266',
      name: 'Sonoff Device (eWeLink_1000f28266)', type: 'switch', vendor: 'Sonoff', status: 'ASSIGNED',
      integrationSource: 'sonoff', invertState: false, lastKnownState: { on: true, state: 'on' },
      entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    };

    deviceRepository = {
      findByExternalId: jest.fn().mockImplementation(() => Promise.resolve(device)),
      findDeviceById: jest.fn().mockImplementation(() => Promise.resolve(device)),
      saveDevice: jest.fn().mockImplementation((updated: Device) => { device = updated; return Promise.resolve(); })
    };

    syncDeps = {
      deviceRepository,
      eventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
      idGenerator: { generate: () => 'id-1' },
      clock: { now: () => '2026-01-01T00:01:00.000Z' }
    };

    service = new SonoffLanDiscoveryService({
      deviceRepository,
      homeRepository: {} as any,
      syncDeps
    });

    SonoffConnectionRegistry.registerIp('eWeLink_1000f28266', '192.168.1.50');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const pollOnce = () => (service as unknown as { pollStates(): Promise<void> }).pollStates();

  it('marks a device unavailable after 3 consecutive failed polls, not before', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

    await pollOnce();
    expect(device.lastKnownState?.state).not.toBe('unavailable');

    await pollOnce();
    expect(device.lastKnownState?.state).not.toBe('unavailable');

    await pollOnce();
    expect(device.lastKnownState?.state).toBe('unavailable');
    expect(deviceRepository.saveDevice).toHaveBeenCalledTimes(1);
  });

  it('does not keep re-saving once already marked unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;

    await pollOnce();
    await pollOnce();
    await pollOnce();
    await pollOnce();
    await pollOnce();

    expect(deviceRepository.saveDevice).toHaveBeenCalledTimes(1);
  });

  it('a single successful poll resets the failure streak', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    await pollOnce();
    await pollOnce();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { switch: 'on' } })
    }) as unknown as typeof fetch;
    await pollOnce();

    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    await pollOnce();
    await pollOnce();
    expect(device.lastKnownState?.state).not.toBe('unavailable');
  });

  it('restores availability once the device answers again after being marked unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
    await pollOnce();
    await pollOnce();
    await pollOnce();
    expect(device.lastKnownState?.state).toBe('unavailable');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { switch: 'on' } })
    }) as unknown as typeof fetch;
    await pollOnce();

    expect(device.lastKnownState?.state).toBe('on');
  });
});
