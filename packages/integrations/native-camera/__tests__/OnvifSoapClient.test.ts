import { OnvifSoapClient, OnvifUnauthorizedError, orderProfilesByPreference } from '../infrastructure/onvif/OnvifSoapClient';
import type { OnvifVideoProfile } from '../infrastructure/onvif/OnvifSoapClient';

const CREDENTIALS = { username: 'admin', password: 'secret' };

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/soap+xml' } });
}

function getCapabilitiesXml(mediaXAddr: string) {
  return `<?xml version="1.0"?>
    <Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
      <Body>
        <tds:GetCapabilitiesResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
          <tds:Capabilities>
            <tt:Media xmlns:tt="http://www.onvif.org/ver10/schema"><tt:XAddr>${mediaXAddr}</tt:XAddr></tt:Media>
          </tds:Capabilities>
        </tds:GetCapabilitiesResponse>
      </Body>
    </Envelope>`;
}

// fast-xml-parser returns a plain object (not an array) for a single <Profiles> child —
// this is the #1 crash source the plan called out; must be covered explicitly.
function getProfilesXmlSingle() {
  return `<?xml version="1.0"?>
    <Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
      <Body>
        <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
          <trt:Profiles token="Profile_1" xmlns:tt="http://www.onvif.org/ver10/schema">
            <tt:Name>MainStream</tt:Name>
            <tt:VideoEncoderConfiguration>
              <tt:Encoding>H264</tt:Encoding>
              <tt:Resolution><tt:Width>1920</tt:Width><tt:Height>1080</tt:Height></tt:Resolution>
            </tt:VideoEncoderConfiguration>
          </trt:Profiles>
        </trt:GetProfilesResponse>
      </Body>
    </Envelope>`;
}

// A vendor whose device exposes two profiles — fast-xml-parser returns an array here.
function getProfilesXmlMultiple() {
  return `<?xml version="1.0"?>
    <Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
      <Body>
        <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
          <trt:Profiles token="Profile_1" xmlns:tt="http://www.onvif.org/ver10/schema">
            <tt:Name>MainStream</tt:Name>
            <tt:VideoEncoderConfiguration>
              <tt:Encoding>H264</tt:Encoding>
              <tt:Resolution><tt:Width>1920</tt:Width><tt:Height>1080</tt:Height></tt:Resolution>
            </tt:VideoEncoderConfiguration>
          </trt:Profiles>
          <trt:Profiles token="Profile_2" xmlns:tt="http://www.onvif.org/ver10/schema">
            <tt:Name>SubStream</tt:Name>
            <tt:VideoEncoderConfiguration>
              <tt:Encoding>H264</tt:Encoding>
              <tt:Resolution><tt:Width>640</tt:Width><tt:Height>480</tt:Height></tt:Resolution>
            </tt:VideoEncoderConfiguration>
            <tt:PTZConfiguration token="PtzCfg_1"/>
          </trt:Profiles>
        </trt:GetProfilesResponse>
      </Body>
    </Envelope>`;
}

function getStreamUriXml(uri: string) {
  return `<?xml version="1.0"?>
    <Envelope xmlns="http://www.w3.org/2003/05/soap-envelope">
      <Body>
        <trt:GetStreamUriResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
          <trt:MediaUri xmlns:tt="http://www.onvif.org/ver10/schema"><tt:Uri>${uri}</tt:Uri></trt:MediaUri>
        </trt:GetStreamUriResponse>
      </Body>
    </Envelope>`;
}

describe('OnvifSoapClient', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getMediaServiceUrl resolves the Media service XAddr from GetCapabilities', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(getCapabilitiesXml('http://192.168.1.50:8000/onvif/media_service'))) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    const mediaUrl = await client.getMediaServiceUrl('http://192.168.1.50:8000/onvif/device_service', CREDENTIALS);

    expect(mediaUrl).toBe('http://192.168.1.50:8000/onvif/media_service');
  });

  it('getProfiles handles a single <Profiles> child (object, not array) without crashing', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(getProfilesXmlSingle())) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    const profiles = await client.getProfiles('http://192.168.1.50:8000/onvif/media_service', CREDENTIALS);

    expect(profiles).toEqual([
      { token: 'Profile_1', name: 'MainStream', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: null }
    ]);
  });

  it('getProfiles handles multiple <Profiles> children (a real array) and extracts the PTZ configuration token', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(getProfilesXmlMultiple())) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    const profiles = await client.getProfiles('http://192.168.1.50:8000/onvif/media_service', CREDENTIALS);

    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toEqual({ token: 'Profile_1', name: 'MainStream', encoding: 'H264', width: 1920, height: 1080, ptzConfigurationToken: null });
    expect(profiles[1]).toEqual({ token: 'Profile_2', name: 'SubStream', encoding: 'H264', width: 640, height: 480, ptzConfigurationToken: 'PtzCfg_1' });
  });

  it('getStreamUri resolves the RTSP URI for the requested profile', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(getStreamUriXml('rtsp://192.168.1.50:554/live/ch0'))) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    const uri = await client.getStreamUri('http://192.168.1.50:8000/onvif/media_service', CREDENTIALS, 'Profile_1');

    expect(uri).toBe('rtsp://192.168.1.50:554/live/ch0');
  });

  it('throws OnvifUnauthorizedError on a 401 response', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse('Unauthorized', 401)) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.getMediaServiceUrl('http://192.168.1.50:8000/onvif/device_service', CREDENTIALS))
      .rejects.toBeInstanceOf(OnvifUnauthorizedError);
  });

  it('throws OnvifUnauthorizedError when the SOAP fault body signals NotAuthorized even without a 401 status', async () => {
    const faultBody = '<Envelope><Body><Fault><Reason>ter:NotAuthorized</Reason></Fault></Body></Envelope>';
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(faultBody, 500)) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.getMediaServiceUrl('http://192.168.1.50:8000/onvif/device_service', CREDENTIALS))
      .rejects.toBeInstanceOf(OnvifUnauthorizedError);
  });

  it('throws a generic error when GetCapabilities reports no Media service', async () => {
    const bodyWithoutMedia = '<Envelope><Body><GetCapabilitiesResponse><Capabilities/></GetCapabilitiesResponse></Body></Envelope>';
    global.fetch = jest.fn().mockResolvedValue(xmlResponse(bodyWithoutMedia)) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.getMediaServiceUrl('http://192.168.1.50:8000/onvif/device_service', CREDENTIALS))
      .rejects.toThrow('ONVIF device did not report a Media service address');
  });

  it('getProfiles returns an empty list when the device reports no profiles', async () => {
    global.fetch = jest.fn().mockResolvedValue(xmlResponse('<Envelope><Body><GetProfilesResponse/></Body></Envelope>')) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    expect(await client.getProfiles('http://192.168.1.50:8000/onvif/media_service', CREDENTIALS)).toEqual([]);
  });
  it('returns the optional PTZ service address and detects continuous movement capability', async () => {
    const capabilities = '<Envelope><Body><GetCapabilitiesResponse><Capabilities><Media><XAddr>http://media</XAddr></Media><PTZ><XAddr>http://ptz</XAddr></PTZ></Capabilities></GetCapabilitiesResponse></Body></Envelope>';
    const options = '<Envelope><Body><GetConfigurationOptionsResponse><PTZConfigurationOptions><Spaces><ContinuousPanTiltVelocitySpace/></Spaces></PTZConfigurationOptions></GetConfigurationOptionsResponse></Body></Envelope>';
    global.fetch = jest.fn()
      .mockResolvedValueOnce(xmlResponse(capabilities))
      .mockResolvedValueOnce(xmlResponse(options)) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.getCapabilities('http://device', CREDENTIALS)).resolves.toEqual({ mediaXAddr: 'http://media', ptzXAddr: 'http://ptz' });
    await expect(client.getPtzConfigurationOptions('http://ptz', CREDENTIALS, 'config-1')).resolves.toEqual({ supportsContinuousMove: true });
  });

  it('handles absent optional ONVIF data and rejects a missing stream URI or generic server failure', async () => {
    const capabilities = '<Envelope><Body><GetCapabilitiesResponse><Capabilities><Media><XAddr>http://media</XAddr></Media></Capabilities></GetCapabilitiesResponse></Body></Envelope>';
    const noContinuousMove = '<Envelope><Body><GetConfigurationOptionsResponse><PTZConfigurationOptions><Spaces/></PTZConfigurationOptions></GetConfigurationOptionsResponse></Body></Envelope>';
    global.fetch = jest.fn()
      .mockResolvedValueOnce(xmlResponse(capabilities))
      .mockResolvedValueOnce(xmlResponse(noContinuousMove))
      .mockResolvedValueOnce(xmlResponse('<Envelope><Body><GetStreamUriResponse><MediaUri/></GetStreamUriResponse></Body></Envelope>'))
      .mockResolvedValueOnce(xmlResponse('gateway error', 502)) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.getCapabilities('http://device', CREDENTIALS)).resolves.toEqual({ mediaXAddr: 'http://media', ptzXAddr: null });
    await expect(client.getPtzConfigurationOptions('http://ptz', CREDENTIALS, 'config-1')).resolves.toEqual({ supportsContinuousMove: false });
    await expect(client.getStreamUri('http://media', CREDENTIALS, 'profile-1')).rejects.toThrow('ONVIF device did not report a stream URI');
    await expect(client.getStreamUri('http://media', CREDENTIALS, 'profile-1')).rejects.toThrow('ONVIF request failed with status 502');
  });

  it('sends continuous move and stop commands successfully', async () => {
    global.fetch = jest.fn(() => Promise.resolve(xmlResponse('<Envelope><Body/></Envelope>'))) as unknown as typeof fetch;
    const client = new OnvifSoapClient();

    await expect(client.continuousMove('http://ptz', CREDENTIALS, 'profile-1', { pan: 0.5, tilt: -0.5, zoom: 0.25 })).resolves.toBeUndefined();
    await expect(client.stopPtz('http://ptz', CREDENTIALS, 'profile-1')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('orderProfilesByPreference', () => {
  const profile = (overrides: Partial<OnvifVideoProfile>): OnvifVideoProfile => ({
    token: 't', name: 'n', encoding: null, width: null, height: null, ptzConfigurationToken: null, ...overrides
  });

  it('prefers H264 over other encodings regardless of resolution', () => {
    const jpegHighRes = profile({ token: 'jpeg', encoding: 'JPEG', width: 1920, height: 1080 });
    const h264LowRes = profile({ token: 'h264', encoding: 'H264', width: 640, height: 480 });

    const ordered = orderProfilesByPreference([jpegHighRes, h264LowRes]);

    expect(ordered[0].token).toBe('h264');
  });

  it('among same-encoding profiles, prefers the highest resolution at or under 1920x1080 over a higher one', () => {
    const uhd = profile({ token: '4k', encoding: 'H264', width: 3840, height: 2160 });
    const fullHd = profile({ token: '1080p', encoding: 'H264', width: 1920, height: 1080 });

    const ordered = orderProfilesByPreference([uhd, fullHd]);

    expect(ordered[0].token).toBe('1080p');
  });

  it('prefers a larger sub-1080p resolution over a smaller one', () => {
    const vga = profile({ token: 'vga', encoding: 'H264', width: 640, height: 480 });
    const hd = profile({ token: 'hd', encoding: 'H264', width: 1280, height: 720 });

    const ordered = orderProfilesByPreference([vga, hd]);

    expect(ordered[0].token).toBe('hd');
  });
});
