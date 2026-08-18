import { RtspDvrCameraDriver } from '../infrastructure/drivers/RtspDvrCameraDriver';
import { DefaultNativeCameraDriverRegistry } from '../infrastructure/drivers/DefaultNativeCameraDriverRegistry';
import type { NativeCameraDriver, NativeCameraEndpoint } from '../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../application/ports/NetworkProbePort';

const endpoint: NativeCameraEndpoint = { host: '192.168.1.35', onvifPort: 80, rtspPort: 554, username: 'admin', password: 'secret', rtspPath: '/Streaming/Channels/101' };

describe('RTSP/DVR native camera driver and registry', () => {
  it('negotiates reachability and represents the explicit no-discovery/no-PTZ capability', async () => {
    const probe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn().mockResolvedValue(true) };
    const driver = new RtspDvrCameraDriver(probe);

    expect(driver.sourceType).toBe('rtsp-dvr');
    expect(driver.supportsDiscovery()).toBe(false);
    expect(driver.supportsPtz()).toBe(false);
    await expect(driver.discover()).resolves.toEqual([]);
    await expect(driver.negotiate(endpoint)).resolves.toEqual({
      outcome: 'reachable',
      profile: { rtspPort: 554, rtspPath: '/Streaming/Channels/101', profileToken: null, ptzConfigurationToken: null, ptzSupported: false }
    });
  });

  it('reports unreachable and the registry resolves known drivers, filters discovery, and fails missing types', async () => {
    const probe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn().mockResolvedValue(false) };
    const rtsp = new RtspDvrCameraDriver(probe);
    const discoverable = { sourceType: 'onvif-ptz', supportsDiscovery: jest.fn().mockReturnValue(true), supportsPtz: jest.fn(), discover: jest.fn(), negotiate: jest.fn() } as unknown as NativeCameraDriver;
    const registry = new DefaultNativeCameraDriverRegistry([rtsp, discoverable]);

    await expect(rtsp.negotiate(endpoint)).resolves.toEqual(expect.objectContaining({ outcome: 'unreachable' }));
    expect(registry.resolve('rtsp-dvr')).toBe(rtsp);
    expect(registry.discoverableDrivers()).toEqual([discoverable]);
    expect(() => registry.resolve('sonoff-rtsp')).toThrow('No native camera driver registered');
  });
});