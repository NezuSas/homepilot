import { Device } from '../../../devices/domain/types';
const mockMdnsFactory = jest.fn();

jest.mock('multicast-dns', () => ({
  __esModule: true,
  default: mockMdnsFactory,
}));

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
  it('discovers a Sonoff light using the active home and TXT metadata', async () => {
    const repository = {
      findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
      saveDevice: jest.fn().mockResolvedValue(undefined),
    };
    const discovery = new SonoffLanDiscoveryService({
      deviceRepository: repository as never,
      homeRepository: {} as never,
    });
    const internals = discovery as unknown as { activeHomeId: string; processDiscoveredDevice(id: string, records: Array<{ type?: string; name?: string; data?: unknown }>): Promise<void> };
    internals.activeHomeId = 'home-1';

    await internals.processDiscoveredDevice('eWeLink_1000abcdef', [
      { type: 'A', name: 'eWeLink_1000abcdef._ewelink._tcp.local', data: '192.168.1.20' },
      { type: 'TXT', name: 'eWeLink_1000abcdef._ewelink._tcp.local', data: [Buffer.from('uiid=1'), Buffer.from('type=light')] },
    ]);

    expect(repository.findByExternalIdAndHomeId).toHaveBeenCalledWith('sonoff:eWeLink_1000abcdef', 'home-1');
    expect(repository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      homeId: 'home-1', type: 'light', vendor: 'Sonoff', name: 'Interruptor Sonoff (ABCDEF)',
      lastKnownState: { on: false, ip: '192.168.1.20' },
    }));
    expect(SonoffConnectionRegistry.getIp('eWeLink_1000abcdef')).toBe('192.168.1.20');
  });

  it('does not duplicate an already known discovery record', async () => {
    const repository = {
      findByExternalIdAndHomeId: jest.fn().mockResolvedValue({ id: 'existing' }),
      saveDevice: jest.fn(),
    };
    const discovery = new SonoffLanDiscoveryService({ deviceRepository: repository as never, homeRepository: {} as never });
    const internals = discovery as unknown as { activeHomeId: string; processDiscoveredDevice(id: string, records: Array<unknown>): Promise<void> };
    internals.activeHomeId = 'home-1';

    await internals.processDiscoveredDevice('eWeLink_existing', []);
    await internals.processDiscoveredDevice('eWeLink_existing', []);

    expect(repository.findByExternalIdAndHomeId).toHaveBeenCalledTimes(1);
    expect(repository.saveDevice).not.toHaveBeenCalled();
  });
  it('prefers a system-owned home and otherwise falls back to the installation home', async () => {
    const systemHomeRepository = {
      findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'system-home' }]),
      findAll: jest.fn(),
    };
    const fallbackHomeRepository = {
      findHomesByUserId: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([{ id: 'installation-home' }]),
    };
    const getTargetHomeId = (instance: SonoffLanDiscoveryService) => (
      instance as unknown as { getTargetHomeId(): Promise<string | null> }
    ).getTargetHomeId();

    const systemService = new SonoffLanDiscoveryService({ deviceRepository: {} as never, homeRepository: systemHomeRepository as never });
    const fallbackService = new SonoffLanDiscoveryService({ deviceRepository: {} as never, homeRepository: fallbackHomeRepository as never });

    await expect(getTargetHomeId(systemService)).resolves.toBe('system-home');
    await expect(getTargetHomeId(fallbackService)).resolves.toBe('installation-home');
    expect(fallbackHomeRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('does not persist a discovery when no installation home exists', async () => {
    const repository = { findByExternalIdAndHomeId: jest.fn(), saveDevice: jest.fn() };
    const homeRepository = { findHomesByUserId: jest.fn().mockResolvedValue([]), findAll: jest.fn().mockResolvedValue([]) };
    const discovery = new SonoffLanDiscoveryService({ deviceRepository: repository as never, homeRepository: homeRepository as never });
    const internals = discovery as unknown as { processDiscoveredDevice(id: string, records: Array<unknown>): Promise<void> };

    await internals.processDiscoveredDevice('eWeLink_without_home', []);

    expect(repository.findByExternalIdAndHomeId).not.toHaveBeenCalled();
    expect(repository.saveDevice).not.toHaveBeenCalled();
  });
  it('treats a non-OK LAN response as reachable and does not increase the failure streak', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: jest.fn() }) as unknown as typeof fetch;

    await pollOnce();
    await pollOnce();
    await pollOnce();

    expect(device.lastKnownState?.state).not.toBe('unavailable');
    expect(deviceRepository.saveDevice).not.toHaveBeenCalled();
  });

  it('does not synchronize again when a successful poll reports the unchanged device state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { switch: 'on' } }),
    }) as unknown as typeof fetch;

    await pollOnce();

    expect(deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(syncDeps.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

describe('SonoffLanDiscoveryService - mDNS lifecycle', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts one mDNS listener, queries the Sonoff service and records the requested home', () => {
    const on = jest.fn();
    const query = jest.fn();
    const destroy = jest.fn();
    mockMdnsFactory.mockReturnValue({ on, query, destroy });
    const service = new SonoffLanDiscoveryService({ deviceRepository: {} as never, homeRepository: {} as never });

    service.startDiscovery('home-1');
    service.startDiscovery('home-2');

    expect(mockMdnsFactory).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith('response', expect.any(Function));
    expect(query).toHaveBeenCalledWith({ questions: [{ name: '_ewelink._tcp.local', type: 'PTR' }] });
    expect((service as unknown as { activeHomeId: string | null }).activeHomeId).toBe('home-1');

    service.stopDiscovery();
  });

  it('destroys the mDNS listener and resets the discovery session when stopped', () => {
    const on = jest.fn();
    const query = jest.fn();
    const destroy = jest.fn();
    mockMdnsFactory.mockReturnValue({ on, query, destroy });
    const service = new SonoffLanDiscoveryService({ deviceRepository: {} as never, homeRepository: {} as never });

    service.startDiscovery();
    service.stopDiscovery();
    service.startDiscovery();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(mockMdnsFactory).toHaveBeenCalledTimes(2);

    service.stopDiscovery();
  });

  it('contains malformed mDNS responses instead of rejecting the event callback', async () => {
    let responseHandler: ((response: { answers?: unknown[]; additionals?: unknown[] }) => Promise<void>) | undefined;
    mockMdnsFactory.mockReturnValue({
      on: jest.fn((_event: string, handler: (response: { answers?: unknown[]; additionals?: unknown[] }) => Promise<void>) => {
        responseHandler = handler;
      }),
      query: jest.fn(),
      destroy: jest.fn(),
    });
    const service = new SonoffLanDiscoveryService({
      deviceRepository: {} as never,
      homeRepository: { findHomesByUserId: jest.fn().mockRejectedValue(new Error('database unavailable')) } as never,
    });

    service.startDiscovery();
    await expect(responseHandler?.({ answers: [{ type: 'SRV', name: 'eWeLink_failure._ewelink._tcp.local' }] })).resolves.toBeUndefined();

    service.stopDiscovery();
  });
});
describe('SonoffLanDiscoveryService - registry and discovery recovery', () => {
  it('tracks connections and resets consecutive poll failures after a fresh LAN address is registered', () => {
    const id = 'eWeLink_registry_case';
    SonoffConnectionRegistry.registerIp(id, '192.168.1.41');
    expect(SonoffConnectionRegistry.getIp(id)).toBe('192.168.1.41');
    expect(SonoffConnectionRegistry.getAllConnections()).toContainEqual([id, expect.objectContaining({ ip: '192.168.1.41' })]);
    expect(SonoffConnectionRegistry.recordPollFailure(id)).toBe(1);
    expect(SonoffConnectionRegistry.recordPollFailure(id)).toBe(2);
    SonoffConnectionRegistry.resetPollFailures(id);
    expect(SonoffConnectionRegistry.recordPollFailure(id)).toBe(1);
  });

  it('releases a failed discovery id so a later response can be persisted', async () => {
    const repository = {
      findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
      saveDevice: jest.fn().mockRejectedValueOnce(new Error('temporary write failure')).mockResolvedValueOnce(undefined),
    };
    const discovery = new SonoffLanDiscoveryService({ deviceRepository: repository as never, homeRepository: {} as never });
    const internals = discovery as unknown as { activeHomeId: string; processDiscoveredDevice(id: string, records: Array<unknown>): Promise<void> };
    internals.activeHomeId = 'home-1';

    await internals.processDiscoveredDevice('eWeLink_retry_discovery', []);
    await internals.processDiscoveredDevice('eWeLink_retry_discovery', []);

    expect(repository.saveDevice).toHaveBeenCalledTimes(2);
  });
});
describe('SonoffLanDiscoveryService - discovery labels', () => {
  it('derives stable local names for plugs, multi-channel switches, 4CH relays, and lights', async () => {
    const cases = [
      { id: 'eWeLink_0000AA', metadata: ['type=plug'], expectedName: 'Tomacorriente Sonoff (0000AA)', expectedType: 'switch' },
      { id: 'eWeLink_0000BB', metadata: ['uiid=2', 'type=switch'], expectedName: 'Interruptor Múltiple Sonoff (0000BB)', expectedType: 'switch' },
      { id: 'eWeLink_0000CC', metadata: ['uiid=4', 'type=switch'], expectedName: 'Interruptor 4CH Sonoff (0000CC)', expectedType: 'switch' },
      { id: 'eWeLink_0000DD', metadata: ['type=light'], expectedName: 'Luz Sonoff (0000DD)', expectedType: 'light' },
    ] as const;

    for (const testCase of cases) {
      const repository = {
        findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
        saveDevice: jest.fn().mockResolvedValue(undefined),
      };
      const service = new SonoffLanDiscoveryService({ deviceRepository: repository as never, homeRepository: {} as never });
      const internals = service as unknown as {
        activeHomeId: string;
        processDiscoveredDevice(id: string, records: Array<{ type?: string; name?: string; data?: unknown }>): Promise<void>;
      };
      internals.activeHomeId = 'home-1';

      await internals.processDiscoveredDevice(testCase.id, [
        { type: 'TXT', name: `${testCase.id}._ewelink._tcp.local`, data: testCase.metadata.map((value) => Buffer.from(value)) },
      ]);

      expect(repository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
        name: testCase.expectedName,
        type: testCase.expectedType,
        lastKnownState: { on: false, ip: null },
      }));
    }
  });

  it('processes a complete Sonoff mDNS response through the registered listener', async () => {
    let responseHandler: ((response: { answers?: Array<{ type?: string; name?: string; data?: unknown }>; additionals?: Array<{ type?: string; name?: string; data?: unknown }> }) => Promise<void>) | undefined;
    mockMdnsFactory.mockReturnValue({
      on: jest.fn((_event: string, handler: typeof responseHandler) => { responseHandler = handler; }),
      query: jest.fn(),
      destroy: jest.fn(),
    });
    const repository = {
      findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
      saveDevice: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SonoffLanDiscoveryService({ deviceRepository: repository as never, homeRepository: {} as never });

    service.startDiscovery('home-1');
    await responseHandler?.({
      answers: [{ type: 'SRV', name: 'eWeLink_listener._ewelink._tcp.local' }],
      additionals: [
        { type: 'A', name: 'eWeLink_listener._ewelink._tcp.local', data: '192.168.1.45' },
        { type: 'TXT', name: 'eWeLink_listener._ewelink._tcp.local', data: [Buffer.from('type=light')] },
      ],
    });

    expect(repository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      homeId: 'home-1',
      externalId: 'sonoff:eWeLink_listener',
      name: 'Luz Sonoff (STENER)',
      lastKnownState: { on: false, ip: '192.168.1.45' },
    }));
    service.stopDiscovery();
  });
  it('starts and clears the LAN polling timer with the discovery lifecycle when synchronization is enabled', () => {
    jest.useFakeTimers();
    const service = new SonoffLanDiscoveryService({
      deviceRepository: {} as never,
      homeRepository: {} as never,
      syncDeps: {} as never,
    });
    mockMdnsFactory.mockReturnValue({ on: jest.fn(), query: jest.fn(), destroy: jest.fn() });

    service.startDiscovery('home-1');
    expect(jest.getTimerCount()).toBe(1);

    service.stopDiscovery();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('ignores a reachable LAN response without a switch value', async () => {
    const deviceRepository = {
      findByExternalId: jest.fn(),
      saveDevice: jest.fn(),
    };
    const service = new SonoffLanDiscoveryService({
      deviceRepository: deviceRepository as never,
      homeRepository: {} as never,
      syncDeps: {
        deviceRepository: deviceRepository as never,
        eventPublisher: { publish: jest.fn() },
        activityLogRepository: { saveActivity: jest.fn() },
        idGenerator: { generate: () => 'id' },
        clock: { now: () => '2026-01-01T00:00:00.000Z' },
      } as never,
    });
    SonoffConnectionRegistry.registerIp('eWeLink_without_switch', '192.168.1.90');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { switch: true } }),
    }) as unknown as typeof fetch;

    await (service as unknown as { pollStates(): Promise<void> }).pollStates();

    expect(deviceRepository.findByExternalId).not.toHaveBeenCalled();
    expect(deviceRepository.saveDevice).not.toHaveBeenCalled();
  });
  it('keeps local polling inert when synchronization dependencies are not configured', async () => {
    const service = new SonoffLanDiscoveryService({ deviceRepository: {} as never, homeRepository: {} as never });
    const pollStates = (service as unknown as { pollStates(): Promise<void> }).pollStates();

    await expect(pollStates).resolves.toBeUndefined();
  });});
