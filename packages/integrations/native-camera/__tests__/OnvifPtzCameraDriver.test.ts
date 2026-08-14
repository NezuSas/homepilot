import { OnvifPtzCameraDriver } from '../infrastructure/drivers/OnvifPtzCameraDriver';
import { OnvifUnauthorizedError } from '../infrastructure/onvif/OnvifSoapClient';
import type { NativeCameraEndpoint } from '../application/ports/NativeCameraDriver';
import type { NetworkProbePort } from '../application/ports/NetworkProbePort';
import type { OnvifWsDiscoveryProbe } from '../infrastructure/onvif/OnvifWsDiscoveryProbe';

const ENDPOINT: NativeCameraEndpoint = {
  host: '192.168.1.50', onvifPort: 8000, rtspPort: 554, username: 'admin', password: 'secret', rtspPath: ''
};

function createFakeSoapClient(overrides?: Partial<{
  getMediaServiceUrl: jest.Mock;
  getProfiles: jest.Mock;
  getStreamUri: jest.Mock;
  getCapabilities: jest.Mock;
  getPtzConfigurationOptions: jest.Mock;
  continuousMove: jest.Mock;
  stopPtz: jest.Mock;
}>) {
  return {
    getMediaServiceUrl: jest.fn().mockResolvedValue('http://192.168.1.50:8000/onvif/media_service'),
    getProfiles: jest.fn().mockResolvedValue([]),
    getStreamUri: jest.fn(),
    getCapabilities: jest.fn().mockRejectedValue(new Error('PTZ service unavailable')),
    getPtzConfigurationOptions: jest.fn(),
    continuousMove: jest.fn().mockResolvedValue(undefined),
    stopPtz: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('OnvifPtzCameraDriver', () => {
  let discoveryProbe: jest.Mocked<OnvifWsDiscoveryProbe>;
  let networkProbe: jest.Mocked<NetworkProbePort>;

  beforeEach(() => {
    discoveryProbe = { probe: jest.fn().mockResolvedValue([]) } as any;
    networkProbe = { isReachable: jest.fn().mockResolvedValue(true) };
  });

  it('negotiates successfully using the first profile whose GetStreamUri succeeds', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: 'Ptz_1' },
      ]),
      getStreamUri: jest.fn().mockResolvedValue('rtsp://192.168.1.50:554/live/ch0'),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result).toEqual({
      outcome: 'negotiated',
      profile: { rtspPort: 554, rtspPath: '/live/ch0', profileToken: 'Profile_1', ptzConfigurationToken: 'Ptz_1', ptzSupported: false }
    });
    expect(networkProbe.isReachable).not.toHaveBeenCalled();
  });

  it('tries the next profile when GetStreamUri fails for the preferred one', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: null },
        { token: 'Profile_2', name: 'Sub', encoding: 'H264', width: 640, height: 480, ptzConfigurationToken: null },
      ]),
      getStreamUri: jest.fn()
        .mockRejectedValueOnce(new Error('stream not available for Profile_1'))
        .mockResolvedValueOnce('rtsp://192.168.1.50:554/live/ch1'),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result).toEqual({
      outcome: 'negotiated',
      profile: { rtspPort: 554, rtspPath: '/live/ch1', profileToken: 'Profile_2', ptzConfigurationToken: null, ptzSupported: false }
    });
  });

  it('returns unauthorized when ONVIF rejects the credentials, without falling back to TCP', async () => {
    const soapClient = createFakeSoapClient({
      getMediaServiceUrl: jest.fn().mockRejectedValue(new OnvifUnauthorizedError()),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result).toEqual({ outcome: 'unauthorized' });
    expect(networkProbe.isReachable).not.toHaveBeenCalled();
  });

  it('falls back to TCP reachability when ONVIF fails for a non-auth reason', async () => {
    const soapClient = createFakeSoapClient({
      getMediaServiceUrl: jest.fn().mockRejectedValue(new Error('network timeout')),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(networkProbe.isReachable).toHaveBeenCalledWith(ENDPOINT.host, ENDPOINT.rtspPort, 5000);
    expect(result).toEqual({
      outcome: 'reachable',
      profile: { rtspPort: 554, rtspPath: '', profileToken: null, ptzConfigurationToken: null, ptzSupported: false }
    });
  });

  it('falls back to TCP reachability when no profile yields a usable stream URI', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: null },
      ]),
      getStreamUri: jest.fn().mockRejectedValue(new Error('unsupported profile')),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result.outcome).toBe('reachable');
  });

  it('reports unreachable when ONVIF fails and TCP is also unreachable', async () => {
    networkProbe.isReachable.mockResolvedValue(false);
    const soapClient = createFakeSoapClient({
      getMediaServiceUrl: jest.fn().mockRejectedValue(new Error('network timeout')),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result.outcome).toBe('unreachable');
  });

  it('supportsDiscovery is true and discover() delegates to the WS-Discovery probe', async () => {
    discoveryProbe.probe.mockResolvedValue([{ urn: 'urn:1', name: 'Cam', host: '10.0.0.5', onvifPort: 8000 }]);
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, createFakeSoapClient());

    expect(driver.supportsDiscovery()).toBe(true);
    expect(await driver.discover()).toEqual([{ urn: 'urn:1', name: 'Cam', host: '10.0.0.5', onvifPort: 8000 }]);
  });

  it('marks ptzSupported=true when the negotiated profile confirms continuous move', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: 'Ptz_1' },
      ]),
      getStreamUri: jest.fn().mockResolvedValue('rtsp://192.168.1.50:554/live/ch0'),
      getCapabilities: jest.fn().mockResolvedValue({ mediaXAddr: 'http://192.168.1.50:8000/onvif/media_service', ptzXAddr: 'http://192.168.1.50:8000/onvif/ptz_service' }),
      getPtzConfigurationOptions: jest.fn().mockResolvedValue({ supportsContinuousMove: true }),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result).toEqual({
      outcome: 'negotiated',
      profile: { rtspPort: 554, rtspPath: '/live/ch0', profileToken: 'Profile_1', ptzConfigurationToken: 'Ptz_1', ptzSupported: true }
    });
    expect(soapClient.getPtzConfigurationOptions).toHaveBeenCalledWith('http://192.168.1.50:8000/onvif/ptz_service', { username: 'admin', password: 'secret' }, 'Ptz_1');
  });

  it('leaves ptzSupported=false when the camera has no PTZ service address', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: 'Ptz_1' },
      ]),
      getStreamUri: jest.fn().mockResolvedValue('rtsp://192.168.1.50:554/live/ch0'),
      getCapabilities: jest.fn().mockResolvedValue({ mediaXAddr: 'http://192.168.1.50:8000/onvif/media_service', ptzXAddr: null }),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result.outcome).toBe('negotiated');
    if (result.outcome === 'negotiated') expect(result.profile.ptzSupported).toBe(false);
    expect(soapClient.getPtzConfigurationOptions).not.toHaveBeenCalled();
  });

  it('never persists ptzSupported=true for a profile without a PTZ configuration token', async () => {
    const soapClient = createFakeSoapClient({
      getProfiles: jest.fn().mockResolvedValue([
        { token: 'Profile_1', name: 'Main', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: null },
      ]),
      getStreamUri: jest.fn().mockResolvedValue('rtsp://192.168.1.50:554/live/ch0'),
    });
    const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

    const result = await driver.negotiate(ENDPOINT);

    expect(result.outcome).toBe('negotiated');
    if (result.outcome === 'negotiated') expect(result.profile.ptzSupported).toBe(false);
    expect(soapClient.getCapabilities).not.toHaveBeenCalled();
  });

  describe('supportsPtz', () => {
    it('reflects the negotiated profile flag', () => {
      const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, createFakeSoapClient());
      expect(driver.supportsPtz({ rtspPort: 554, rtspPath: '', profileToken: 'p', ptzConfigurationToken: 'c', ptzSupported: true })).toBe(true);
      expect(driver.supportsPtz({ rtspPort: 554, rtspPath: '', profileToken: 'p', ptzConfigurationToken: null, ptzSupported: false })).toBe(false);
    });
  });

  describe('movePtz / stopPtz', () => {
    const PROFILE = { rtspPort: 554, rtspPath: '/live/ch0', profileToken: 'Profile_1', ptzConfigurationToken: 'Ptz_1', ptzSupported: true };

    it('movePtz resolves the PTZ service address and issues a ContinuousMove', async () => {
      const soapClient = createFakeSoapClient({
        getCapabilities: jest.fn().mockResolvedValue({ mediaXAddr: 'http://192.168.1.50:8000/onvif/media_service', ptzXAddr: 'http://192.168.1.50:8000/onvif/ptz_service' }),
      });
      const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

      await driver.movePtz(ENDPOINT, PROFILE, { pan: 0.5, tilt: -0.3, zoom: 0 });

      expect(soapClient.continuousMove).toHaveBeenCalledWith(
        'http://192.168.1.50:8000/onvif/ptz_service',
        { username: 'admin', password: 'secret' },
        'Profile_1',
        { pan: 0.5, tilt: -0.3, zoom: 0 }
      );
    });

    it('stopPtz resolves the PTZ service address and issues a Stop', async () => {
      const soapClient = createFakeSoapClient({
        getCapabilities: jest.fn().mockResolvedValue({ mediaXAddr: 'http://192.168.1.50:8000/onvif/media_service', ptzXAddr: 'http://192.168.1.50:8000/onvif/ptz_service' }),
      });
      const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

      await driver.stopPtz(ENDPOINT, PROFILE);

      expect(soapClient.stopPtz).toHaveBeenCalledWith(
        'http://192.168.1.50:8000/onvif/ptz_service',
        { username: 'admin', password: 'secret' },
        'Profile_1'
      );
    });

    it('movePtz throws when the camera has no profileToken', async () => {
      const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, createFakeSoapClient());
      await expect(driver.movePtz(ENDPOINT, { ...PROFILE, profileToken: null }, { pan: 1 })).rejects.toThrow();
    });

    it('movePtz throws when the camera reports no PTZ service address', async () => {
      const soapClient = createFakeSoapClient({
        getCapabilities: jest.fn().mockResolvedValue({ mediaXAddr: 'http://192.168.1.50:8000/onvif/media_service', ptzXAddr: null }),
      });
      const driver = new OnvifPtzCameraDriver(discoveryProbe, networkProbe, soapClient);

      await expect(driver.movePtz(ENDPOINT, PROFILE, { pan: 1 })).rejects.toThrow();
    });
  });
});
