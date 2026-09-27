import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { AndroidDisplayBridgePort } from '../application/AndroidDisplayBridgePort';
import { AndroidDisplayBridgeError } from '../application/AndroidDisplayBridgePort';
import { AndroidDisplayService } from '../application/AndroidDisplayService';
import type { AndroidDisplaySource, AndroidDisplaySourceRepository } from '../domain/AndroidDisplaySource';

const metadata = {
  adbSerial: '192.168.1.37:5555', androidId: 'droidlogic-11', manufacturer: 'Droidlogic',
  model: 'C-T982-61-4G-A52D', androidVersion: '11', resolution: '3840x2160',
  densityDpi: 480, screenState: 'awake' as const,
};

describe('AndroidDisplayService', () => {
  let sources: jest.Mocked<AndroidDisplaySourceRepository>;
  let bridge: jest.Mocked<AndroidDisplayBridgePort>;
  let service: AndroidDisplayService;
  beforeEach(() => {
    sources = {
      findByDeviceId: jest.fn().mockReturnValue(null), findByEndpoint: jest.fn().mockReturnValue(null),
      findByAndroidId: jest.fn().mockReturnValue(null), listByHomeId: jest.fn().mockReturnValue([]),
      createWithDevice: jest.fn(), updateObservation: jest.fn(),
    };
    bridge = {
      connect: jest.fn().mockResolvedValue('online'), state: jest.fn().mockResolvedValue('online'),
      inspect: jest.fn().mockResolvedValue(metadata), execute: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const homes = { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }) } as unknown as HomeRepository;
    service = new AndroidDisplayService(sources, homes, bridge);
  });

  it('adopts an online display with a stable UUID and sanitized metadata', async () => {
    const source = await service.adopt({ homeId: 'home-1', name: 'Pizarra', host: '192.168.1.37', port: 5555 });
    expect(source.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(source.metadata).toEqual(metadata);
    expect(sources.createWithDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: source.deviceId, type: 'smart_display', semanticType: 'smart_display', integrationSource: 'android-display' }),
      source,
    );
    expect(bridge.connect).toHaveBeenCalledWith(source.deviceId, '192.168.1.37', 5555);
  });

  it('rejects an endpoint outside private LAN before contacting the bridge', async () => {
    await expect(service.adopt({ homeId: 'home-1', name: 'Bad', host: '8.8.8.8' })).rejects.toMatchObject({ code: 'INVALID_ADB_ENDPOINT' });
    expect(bridge.connect).not.toHaveBeenCalled();
  });

  it('preserves the bridge CIDR allowlist for private addresses outside the approved subnet', async () => {
    bridge.connect.mockRejectedValueOnce(new AndroidDisplayBridgeError('ADB_ENDPOINT_NOT_ALLOWED'));
    await expect(service.adopt({ homeId: 'home-1', name: 'Other subnet', host: '192.168.2.37' }))
      .rejects.toMatchObject({ code: 'ADB_ENDPOINT_NOT_ALLOWED' });
    expect(sources.createWithDevice).not.toHaveBeenCalled();
  });

  it('does not duplicate an endpoint or recognized Android identity', async () => {
    sources.findByEndpoint.mockReturnValueOnce({ deviceId: 'known' } as AndroidDisplaySource);
    await expect(service.adopt({ homeId: 'home-1', name: 'Again', host: '192.168.1.37' }))
      .rejects.toMatchObject({ code: 'DISPLAY_ALREADY_EXISTS' });
    sources.findByAndroidId.mockReturnValueOnce({ deviceId: 'known' } as AndroidDisplaySource);
    await expect(service.adopt({ homeId: 'home-1', name: 'Again', host: '192.168.1.38' }))
      .rejects.toMatchObject({ code: 'DISPLAY_ALREADY_EXISTS' });
    expect(bridge.disconnect).toHaveBeenCalledTimes(1);
    expect(sources.createWithDevice).not.toHaveBeenCalled();
  });

  it('does not persist offline or unauthorized displays', async () => {
    bridge.connect.mockResolvedValueOnce('offline').mockResolvedValueOnce('needs_authorization');
    await expect(service.adopt({ homeId: 'home-1', name: 'Offline', host: '192.168.1.37' }))
      .rejects.toMatchObject({ code: 'DISPLAY_OFFLINE' });
    await expect(service.adopt({ homeId: 'home-1', name: 'Unapproved', host: '192.168.1.37' }))
      .rejects.toMatchObject({ code: 'DISPLAY_NEEDS_AUTHORIZATION' });
    expect(sources.createWithDevice).not.toHaveBeenCalled();
  });

  it('accepts partial inspect data without inventing missing fields', async () => {
    bridge.inspect.mockResolvedValueOnce({ ...metadata, androidId: null, resolution: null, screenState: 'unknown' });
    const source = await service.adopt({ homeId: 'home-1', name: 'Partial', host: '192.168.1.37' });
    expect(source.metadata.androidId).toBeNull();
    expect(source.metadata.resolution).toBeNull();
    expect(source.metadata.screenState).toBe('unknown');
  });

  it('uses a temporary bridge registration for test and always releases it', async () => {
    const result = await service.test({ host: '192.168.1.37', port: 5555 });
    expect(result.connectionState).toBe('online');
    expect(result.metadata.model).toBe(metadata.model);
    expect(bridge.disconnect).toHaveBeenCalledWith(bridge.connect.mock.calls[0][0]);
  });

  it('marks a refreshed display offline and keeps screen state unknown after a bridge failure', async () => {
    const source: AndroidDisplaySource = {
      deviceId: 'd-1', homeId: 'home-1', adbHost: '192.168.1.37', adbPort: 5555,
      enabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      connectionState: 'online', lastSeenAt: '2026-01-01', metadata,
    };
    sources.findByDeviceId.mockReturnValue(source);
    bridge.connect.mockRejectedValueOnce(new AndroidDisplayBridgeError('BRIDGE_TIMEOUT'));
    await expect(service.refresh('d-1')).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' });
    expect(sources.updateObservation).toHaveBeenCalledWith(expect.objectContaining({
      connectionState: 'offline', metadata: expect.objectContaining({ screenState: 'unknown' }),
    }));
  });

  it('blocks an observed Android identity change', async () => {
    sources.findByDeviceId.mockReturnValue({
      deviceId: 'd-1', homeId: 'home-1', adbHost: '192.168.1.37', adbPort: 5555,
      enabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      connectionState: 'online', lastSeenAt: '2026-01-01', metadata,
    });
    bridge.inspect.mockResolvedValueOnce({ ...metadata, androidId: 'replaced' });
    expect((await service.refresh('d-1')).connectionState).toBe('identity_mismatch');
  });
});
