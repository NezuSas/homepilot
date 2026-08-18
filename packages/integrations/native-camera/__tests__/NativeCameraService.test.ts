import { isNativeCameraSourceType, isValidPort, NativeCameraService } from '../application/NativeCameraService';
import type { NativeCameraSource, NativeCameraSourceRepository } from '../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriverRegistry } from '../application/ports/NativeCameraDriverRegistry';
import type { NativeCameraDriver, NativeCameraNegotiation } from '../application/ports/NativeCameraDriver';

function createFakeSourceRepository(): jest.Mocked<NativeCameraSourceRepository> {
  const rows = new Map<string, NativeCameraSource>();
  return {
    findByDeviceId: jest.fn((deviceId: string) => rows.get(deviceId) ?? null),
    findByHomeId: jest.fn((homeId: string) => Array.from(rows.values()).filter((r) => r.homeId === homeId)),
    findDuplicate: jest.fn((homeId, host, rtspPort, rtspPath, excludedDeviceId) =>
      Array.from(rows.values()).find((r) =>
        r.homeId === homeId && r.host === host && r.rtspPort === rtspPort && r.rtspPath === rtspPath && r.deviceId !== excludedDeviceId
      ) ?? null),
    save: jest.fn((source: NativeCameraSource) => { rows.set(source.deviceId, source); }),
  };
}

function createFakeDriver(sourceType: NativeCameraDriver['sourceType'], negotiation: NativeCameraNegotiation): jest.Mocked<NativeCameraDriver> {
  return {
    sourceType,
    supportsDiscovery: jest.fn().mockReturnValue(false),
    discover: jest.fn().mockResolvedValue([]),
    negotiate: jest.fn().mockResolvedValue(negotiation),
    supportsPtz: jest.fn().mockReturnValue(false),
  };
}

describe('NativeCameraService', () => {
  let sourceRepository: jest.Mocked<NativeCameraSourceRepository>;
  let deviceRepository: any;
  let homeRepository: any;

  beforeEach(() => {
    sourceRepository = createFakeSourceRepository();
    deviceRepository = { saveDevice: jest.fn().mockResolvedValue(undefined), findDeviceById: jest.fn(), deleteDevice: jest.fn().mockResolvedValue(undefined) };
    homeRepository = { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }) };
  });

  function buildService(driver: NativeCameraDriver) {
    const registry: jest.Mocked<NativeCameraDriverRegistry> = {
      resolve: jest.fn().mockReturnValue(driver),
      discoverableDrivers: jest.fn().mockReturnValue(driver.supportsDiscovery() ? [driver] : []),
    };
    return new NativeCameraService(sourceRepository, deviceRepository, homeRepository, registry);
  }

  it('rejects creation when required fields are missing', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const result = await service.create({ homeId: '', name: '', host: '', username: '', password: '' } as any);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('VALIDATION_ERROR');
  });

  it('rejects creation when the home does not exist', async () => {
    homeRepository.findHomeById.mockResolvedValue(null);
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const result = await service.create({ homeId: 'home-x', name: 'Cam', host: '192.168.1.5', username: 'a', password: 'b', sourceType: 'rtsp-dvr', rtspPath: '/stream' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('HOME_NOT_FOUND');
  });

  it('maps an unauthorized ONVIF negotiation to CAMERA_CONNECTION_FAILED', async () => {
    const driver = createFakeDriver('onvif-ptz', { outcome: 'unauthorized' });
    const service = buildService(driver);

    const result = await service.create({ homeId: 'home-1', name: 'Cam', host: '192.168.1.5', username: 'a', password: 'b', sourceType: 'onvif-ptz' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('CAMERA_CONNECTION_FAILED');
  });

  it('maps an unreachable negotiation to CAMERA_CONNECTION_FAILED with a descriptive message', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'unreachable', detail: 'No se pudo alcanzar la cámara en 10.0.0.5:554.' });
    const service = buildService(driver);

    const result = await service.create({ homeId: 'home-1', name: 'Cam', host: '10.0.0.5', username: 'a', password: 'b', sourceType: 'rtsp-dvr', rtspPath: '/stream' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CAMERA_CONNECTION_FAILED');
      expect(result.error.message).toContain('10.0.0.5:554');
    }
  });

  it('never calls the ONVIF driver for a rtsp-dvr source (protocol isolation)', async () => {
    const onvifDriver = createFakeDriver('onvif-ptz', { outcome: 'negotiated', profile: { rtspPort: 554, rtspPath: '/onvif', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const rtspDriver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const registry: jest.Mocked<NativeCameraDriverRegistry> = {
      resolve: jest.fn((sourceType) => (sourceType === 'onvif-ptz' ? onvifDriver : rtspDriver)),
      discoverableDrivers: jest.fn().mockReturnValue([]),
    };
    const service = new NativeCameraService(sourceRepository, deviceRepository, homeRepository, registry);

    await service.create({ homeId: 'home-1', name: 'DVR', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });

    expect(rtspDriver.negotiate).toHaveBeenCalledTimes(1);
    expect(onvifDriver.negotiate).not.toHaveBeenCalled();
  });

  it('requires an explicit rtspPath for non-ONVIF sources', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const result = await service.create({ homeId: 'home-1', name: 'DVR', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate camera (same home/host/rtspPort/rtspPath)', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const first = await service.create({ homeId: 'home-1', name: 'DVR 1', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });
    expect(first.ok).toBe(true);

    const second = await service.create({ homeId: 'home-1', name: 'DVR 2', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.kind).toBe('NATIVE_CAMERA_ALREADY_EXISTS');
  });

  it('creates a pending camera device with the source type stored as vendor', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const result = await service.create({ homeId: 'home-1', name: 'DVR', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });

    expect(result.ok).toBe(true);
    expect(deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      type: 'camera', status: 'PENDING', integrationSource: 'native-camera', vendor: 'rtsp-dvr'
    }));
  });

  it('discover() aggregates results only from drivers that support discovery', async () => {
    const discoverableDriver = createFakeDriver('onvif-ptz', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    discoverableDriver.supportsDiscovery.mockReturnValue(true);
    discoverableDriver.discover.mockResolvedValue([{ urn: 'urn:1', name: 'Cam 1', host: '10.0.0.5', onvifPort: 8000 }]);
    const nonDiscoverableDriver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const registry: jest.Mocked<NativeCameraDriverRegistry> = {
      resolve: jest.fn(),
      discoverableDrivers: jest.fn().mockReturnValue([discoverableDriver]),
    };
    const service = new NativeCameraService(sourceRepository, deviceRepository, homeRepository, registry);

    const devices = await service.discover();

    expect(devices).toEqual([{ urn: 'urn:1', name: 'Cam 1', host: '10.0.0.5', onvifPort: 8000 }]);
    expect(nonDiscoverableDriver.discover).not.toHaveBeenCalled();
  });

  it('delete() returns CAMERA_NOT_FOUND for an unknown device, otherwise cascades via deviceRepository.deleteDevice', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);

    const missing = await service.delete('unknown-id');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('CAMERA_NOT_FOUND');

    await service.create({ homeId: 'home-1', name: 'DVR', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });
    const created = sourceRepository.findByHomeId('home-1')[0];
    const deleted = await service.delete(created.deviceId);
    expect(deleted.ok).toBe(true);
    expect(deviceRepository.deleteDevice).toHaveBeenCalledWith(created.deviceId);
  });
  it('updates a native camera and synchronizes its device name and PTZ capability', async () => {
    const driver = createFakeDriver('onvif-ptz', { outcome: 'reachable', profile: { rtspPort: 8554, rtspPath: '/new-stream', profileToken: 'profile-1', ptzConfigurationToken: 'ptz-1', ptzSupported: true } });
    deviceRepository.findDeviceById.mockResolvedValue({
      id: 'placeholder', name: 'Old camera', lastKnownState: { ptz: false }, entityVersion: 2,
    });
    const service = buildService(driver);
    const created = await service.create({ homeId: 'home-1', name: 'Old camera', host: '192.168.1.20', username: 'admin', password: 'secret' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    deviceRepository.findDeviceById.mockResolvedValue({
      id: created.value.deviceId, name: 'Old camera', lastKnownState: { ptz: false }, entityVersion: 2,
    });

    const updated = await service.update(created.value.deviceId, { name: 'Front camera', rtspPort: 8554 });

    expect(updated).toEqual(expect.objectContaining({ ok: true }));
    expect(sourceRepository.findByDeviceId(created.value.deviceId)).toEqual(expect.objectContaining({
      name: 'Front camera', rtspPort: 8554, rtspPath: '/new-stream', ptzSupported: true,
    }));
    expect(deviceRepository.saveDevice).toHaveBeenLastCalledWith(expect.objectContaining({
      id: created.value.deviceId, name: 'Front camera', lastKnownState: { ptz: true }, entityVersion: 2,
    }));
  });

  it('rejects invalid ports and missing RTSP paths during update', async () => {
    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);
    const created = await service.create({ homeId: 'home-1', name: 'DVR', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: '/stream' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const invalidPort = await service.update(created.value.deviceId, { rtspPort: 0 });
    const missingPath = await service.update(created.value.deviceId, { rtspPath: '' });

    expect(invalidPort).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: 'VALIDATION_ERROR' }) }));
    expect(missingPath).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: 'VALIDATION_ERROR' }) }));
  });
  it('validates native source types and ports while exposing the sources scoped to a home', async () => {
    expect(isNativeCameraSourceType('onvif-ptz')).toBe(true);
    expect(isNativeCameraSourceType('unknown')).toBe(false);
    expect(isNativeCameraSourceType(554)).toBe(false);
    expect(isValidPort(1)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(554.5)).toBe(false);

    const driver = createFakeDriver('rtsp-dvr', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);
    await service.create({ homeId: 'home-1', name: 'Home one', host: '192.168.1.20', username: 'admin', password: 'secret', sourceType: 'rtsp-dvr', rtspPath: 'stream' });
    expect(service.listByHome('home-1')).toHaveLength(1);
    expect(service.listByHome('other-home')).toEqual([]);
  });

  it('keeps update failures explicit and avoids writing an unchanged device projection', async () => {
    const driver = createFakeDriver('onvif-ptz', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);
    const missing = await service.update('missing', { name: 'Anything' });
    expect(missing).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: 'CAMERA_NOT_FOUND' }) }));

    const created = await service.create({ homeId: 'home-1', name: 'Camera', host: '192.168.1.20', username: 'admin', password: 'secret' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    deviceRepository.findDeviceById.mockResolvedValue({
      id: created.value.deviceId,
      name: 'Camera',
      lastKnownState: { ptz: false },
      entityVersion: 1,
    });
    deviceRepository.saveDevice.mockClear();

    const unchanged = await service.update(created.value.deviceId, {});
    expect(unchanged).toEqual(expect.objectContaining({ ok: true }));
    expect(deviceRepository.saveDevice).not.toHaveBeenCalled();

    driver.negotiate.mockResolvedValueOnce({ outcome: 'unauthorized' });
    const unauthorized = await service.update(created.value.deviceId, { username: 'different' });
    expect(unauthorized).toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ kind: 'CAMERA_CONNECTION_FAILED' }) }));
  });

  it('rejects each remaining required creation field before negotiating with a driver', async () => {
    const driver = createFakeDriver('onvif-ptz', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);
    const valid = { homeId: 'home-1', name: 'Camera', host: '192.168.1.20', username: 'admin', password: 'secret' };

    await expect(service.create({ ...valid, name: '' })).resolves.toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ message: 'name is required' }) }));
    await expect(service.create({ ...valid, host: '' })).resolves.toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ message: 'host is required' }) }));
    await expect(service.create({ ...valid, username: undefined as unknown as string })).resolves.toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ message: 'username is required' }) }));
    await expect(service.create({ ...valid, password: undefined as unknown as string })).resolves.toEqual(expect.objectContaining({ ok: false, error: expect.objectContaining({ message: 'password is required' }) }));

    expect(driver.negotiate).not.toHaveBeenCalled();
  });

  it('reports an unreachable camera while updating without persisting a projection', async () => {
    const driver = createFakeDriver('onvif-ptz', { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/stream', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } });
    const service = buildService(driver);
    const created = await service.create({ homeId: 'home-1', name: 'Camera', host: '192.168.1.20', username: 'admin', password: 'secret' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    deviceRepository.saveDevice.mockClear();
    driver.negotiate.mockResolvedValueOnce({ outcome: 'unreachable', detail: 'Camera host timed out.' });

    await expect(service.update(created.value.deviceId, { host: '192.168.1.99' })).resolves.toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ kind: 'CAMERA_CONNECTION_FAILED', message: 'Camera host timed out.' })
    }));
    expect(deviceRepository.saveDevice).not.toHaveBeenCalled();
  });
});
