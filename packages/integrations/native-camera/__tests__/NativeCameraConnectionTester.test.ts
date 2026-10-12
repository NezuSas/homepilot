import { NativeCameraConnectionTester } from '../application/NativeCameraConnectionTester';
import type { FrameCaptureResult, MediaTranscoderPort } from '../application/ports/MediaTranscoderPort';
import type { NativeCameraDriver, NativeCameraNegotiation } from '../application/ports/NativeCameraDriver';
import type { NativeCameraDriverRegistry } from '../application/ports/NativeCameraDriverRegistry';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const frame: FrameCaptureResult = { ok: true, jpeg: JPEG, codec: 'h264', width: 1920, height: 1080 };
const valid = { sourceType: 'rtsp-dvr', host: '192.168.1.50', username: 'admin', password: 'hunter2-secret', rtspPath: '/Streaming/Channels/101' };

function build(negotiation: NativeCameraNegotiation = { outcome: 'reachable', profile: { rtspPort: 554, rtspPath: '/x', profileToken: null, ptzConfigurationToken: null, ptzSupported: false } },
  capture: FrameCaptureResult = frame) {
  const driver = { negotiate: jest.fn().mockResolvedValue(negotiation) } as unknown as jest.Mocked<NativeCameraDriver>;
  const registry = { resolve: jest.fn().mockReturnValue(driver), discoverableDrivers: jest.fn() } as unknown as jest.Mocked<NativeCameraDriverRegistry>;
  const transcoder = { captureFrame: jest.fn().mockResolvedValue(capture) } as unknown as jest.Mocked<MediaTranscoderPort>;
  return { tester: new NativeCameraConnectionTester(registry, transcoder), driver, registry, transcoder };
}

const everyText = (result: unknown) => JSON.stringify(result);

describe('Feature: trying a camera before saving it', () => {
  describe('input that is refused before touching the network', () => {
    it.each([
      ['no address', { ...valid, host: '' }],
      ['an address with spaces', { ...valid, host: '192.168.1.5 0' }],
      ['an address with a path', { ...valid, host: '192.168.1.50/admin' }],
      ['a URL instead of an address', { ...valid, host: 'rtsp://192.168.1.50' }],
      ['the unspecified address', { ...valid, host: '0.0.0.0' }],
      ['a cloud metadata address', { ...valid, host: '169.254.169.254' }],
      ['a link-local address', { ...valid, host: '169.254.10.20' }],
      ['no user', { ...valid, username: '' }],
      ['no password', { ...valid, password: undefined }],
      ['a port of zero', { ...valid, rtspPort: 0 }],
      ['a port above 65535', { ...valid, rtspPort: 70000 }],
      ['a fractional port', { ...valid, onvifPort: 80.5 }],
      ['no video path on an RTSP camera', { ...valid, rtspPath: '' }],
    ])('Scenario: Given %s When tested Then INVALID_INPUT and no connection is attempted', async (_name, input) => {
      const { tester, driver, transcoder } = build();

      const result = await tester.test(input as Record<string, unknown>);

      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
      expect(driver.negotiate).not.toHaveBeenCalled();
      expect(transcoder.captureFrame).not.toHaveBeenCalled();
    });
  });

  describe('a camera that answers', () => {
    it('Scenario: Given an RTSP camera that sends video When tested Then the picture and details are returned', async () => {
      const { tester, transcoder } = build();

      const result = await tester.test(valid);

      expect(result).toEqual({ ok: true, value: { snapshot: `data:image/jpeg;base64,${JPEG.toString('base64')}`, width: 1920, height: 1080, codec: 'h264', ptzSupported: false } });
      expect(transcoder.captureFrame).toHaveBeenCalledWith({ host: '192.168.1.50', rtspPort: 554, rtspPath: '/Streaming/Channels/101', username: 'admin', password: 'hunter2-secret' });
    });

    it('Scenario: Given an RTSP camera When tested Then it is not negotiated, the real stream is the test', async () => {
      const { tester, driver } = build();

      await tester.test(valid);

      expect(driver.negotiate).not.toHaveBeenCalled();
    });

    it('Scenario: Given an ONVIF camera When tested Then the video path comes from the negotiated profile and PTZ is reported', async () => {
      const { tester, driver, transcoder } = build({ outcome: 'negotiated', profile: { rtspPort: 8554, rtspPath: '/onvif/profile1/media.smp', profileToken: 'p1', ptzConfigurationToken: 'ptz', ptzSupported: true } });

      const result = await tester.test({ sourceType: 'onvif-ptz', host: 'camera.local', username: 'admin', password: 'x', onvifPort: 8899 });

      expect(driver.negotiate).toHaveBeenCalledWith(expect.objectContaining({ host: 'camera.local', onvifPort: 8899 }));
      expect(transcoder.captureFrame).toHaveBeenCalledWith(expect.objectContaining({ rtspPort: 8554, rtspPath: '/onvif/profile1/media.smp' }));
      expect(result).toMatchObject({ ok: true, value: { ptzSupported: true } });
    });

    it('Scenario: Given no source type When tested Then it is treated as ONVIF like the real alta', async () => {
      const { tester, driver } = build();

      await tester.test({ host: '192.168.1.60', username: 'admin', password: 'x' });

      expect(driver.negotiate).toHaveBeenCalledWith(expect.objectContaining({ onvifPort: 8000 }));
    });
  });

  describe('a camera that does not answer', () => {
    it.each([
      ['UNAUTHORIZED', 'CREDENTIALS_REJECTED'],
      ['NOT_FOUND', 'PATH_NOT_FOUND'],
      ['CONNECTION_REFUSED', 'PORT_CLOSED'],
      ['UNREACHABLE', 'UNREACHABLE'],
      ['TIMEOUT', 'TIMEOUT'],
      ['NO_VIDEO', 'NO_VIDEO'],
      ['FAILED', 'NO_VIDEO'],
    ] as const)('Scenario: Given the reason %s When tested Then it says %s with a message and a hint to act on', async (reason, code) => {
      const { tester } = build(undefined, { ok: false, reason });

      const result = await tester.test(valid);

      expect(result).toMatchObject({ ok: false, error: { code } });
      if (!result.ok) {
        expect(result.error.message.length).toBeGreaterThan(10);
        expect(result.error.hint.length).toBeGreaterThan(10);
      }
    });

    it('Scenario: Given ONVIF credentials that are rejected When tested Then CREDENTIALS_REJECTED and the stream is never opened', async () => {
      const { tester, transcoder } = build({ outcome: 'unauthorized' });

      const result = await tester.test({ sourceType: 'onvif-ptz', host: '192.168.1.60', username: 'admin', password: 'wrong' });

      expect(result).toMatchObject({ ok: false, error: { code: 'CREDENTIALS_REJECTED' } });
      expect(transcoder.captureFrame).not.toHaveBeenCalled();
    });

    it('Scenario: Given an ONVIF camera that cannot be reached When tested Then UNREACHABLE names the address', async () => {
      const { tester } = build({ outcome: 'unreachable', detail: 'no route' });

      const result = await tester.test({ sourceType: 'onvif-ptz', host: '192.168.1.60', username: 'admin', password: 'x' });

      expect(result).toMatchObject({ ok: false, error: { code: 'UNREACHABLE' } });
      expect(everyText(result)).toContain('192.168.1.60');
    });

    it('Scenario: Given a closed port When tested Then the message names that port', async () => {
      const { tester } = build(undefined, { ok: false, reason: 'CONNECTION_REFUSED' });

      const result = await tester.test({ ...valid, rtspPort: 8554 });

      expect(everyText(result)).toContain('8554');
    });
  });

  describe('secrets', () => {
    it.each(['UNAUTHORIZED', 'NOT_FOUND', 'CONNECTION_REFUSED', 'UNREACHABLE', 'TIMEOUT', 'NO_VIDEO', 'FAILED'] as const)(
      'Scenario: Given the failure %s When tested Then nothing in the answer carries the user, the password or the path', async (reason) => {
        const { tester } = build(undefined, { ok: false, reason });

        const answer = everyText(await tester.test({ ...valid, username: 'operator-user', password: 'top-secret-password', rtspPath: '/stream?password=embedded-secret' }));

        expect(answer).not.toContain('top-secret-password');
        expect(answer).not.toContain('operator-user');
        expect(answer).not.toContain('embedded-secret');
        expect(answer).not.toContain('/stream?');
      });

    it('Scenario: Given a successful test When answered Then the answer does not carry the credentials either', async () => {
      const { tester } = build();

      const answer = everyText(await tester.test({ ...valid, password: 'top-secret-password' }));

      expect(answer).not.toContain('top-secret-password');
    });
  });
});
