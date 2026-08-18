import { SonoffRtspCameraDriver } from '../infrastructure/drivers/SonoffRtspCameraDriver';
import type { NativeCameraEndpoint } from '../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../application/ports/NetworkProbePort';

const endpoint: NativeCameraEndpoint = {
  host: '192.168.1.60',
  onvifPort: 8899,
  rtspPort: 554,
  username: 'admin',
  password: 'secret',
  rtspPath: '/stream/main'
};

describe('SonoffRtspCameraDriver', () => {
  it('does not expose discovery or PTZ and returns an empty discovery result', async () => {
    const probe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn() };
    const driver = new SonoffRtspCameraDriver(probe);

    expect(driver.sourceType).toBe('sonoff-rtsp');
    expect(driver.supportsDiscovery()).toBe(false);
    expect(driver.supportsPtz()).toBe(false);
    await expect(driver.discover()).resolves.toEqual([]);
    expect(probe.isReachable).not.toHaveBeenCalled();
  });

  it('negotiates the supplied RTSP endpoint through TCP reachability', async () => {
    const probe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn().mockResolvedValue(true) };
    const driver = new SonoffRtspCameraDriver(probe);

    await expect(driver.negotiate(endpoint)).resolves.toEqual({
      outcome: 'reachable',
      profile: { rtspPort: 554, rtspPath: '/stream/main', profileToken: null, ptzConfigurationToken: null, ptzSupported: false }
    });
    expect(probe.isReachable).toHaveBeenCalledWith('192.168.1.60', 554, 5000);
  });

  it('reports an actionable unreachable result when the RTSP socket cannot be reached', async () => {
    const probe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn().mockResolvedValue(false) };
    const driver = new SonoffRtspCameraDriver(probe);

    await expect(driver.negotiate(endpoint)).resolves.toEqual(expect.objectContaining({
      outcome: 'unreachable',
      detail: expect.stringContaining('192.168.1.60:554')
    }));
  });
});