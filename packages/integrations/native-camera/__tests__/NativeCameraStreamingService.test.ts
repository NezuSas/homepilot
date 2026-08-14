import { NativeCameraStreamingService } from '../application/NativeCameraStreamingService';
import type { MediaTranscoderPort } from '../application/ports/MediaTranscoderPort';
import type { NativeCameraSource } from '../../../devices/domain/repositories/NativeCameraSourceRepository';

function createTestSource(overrides?: Partial<NativeCameraSource>): NativeCameraSource {
  return {
    deviceId: 'cam-1', homeId: 'home-1', sourceType: 'rtsp-dvr', name: 'DVR',
    host: '192.168.1.20', onvifPort: 80, rtspPort: 554, username: 'admin', password: 'secret',
    rtspPath: '/stream', enabled: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    profileToken: null, ptzConfigurationToken: null, ptzSupported: false,
    ...overrides
  };
}

describe('NativeCameraStreamingService', () => {
  let transcoder: jest.Mocked<MediaTranscoderPort>;
  let service: NativeCameraStreamingService;

  beforeEach(() => {
    transcoder = {
      ensureHlsRuntime: jest.fn().mockResolvedValue({ directory: '/tmp/homepilot-native-cameras/cam-1' }),
      stopHlsRuntime: jest.fn(),
      streamSnapshot: jest.fn(),
      streamMjpeg: jest.fn(),
    };
    service = new NativeCameraStreamingService(transcoder);
  });

  it('translates a NativeCameraSource into the transcoder RTSP endpoint shape when ensuring an HLS runtime', async () => {
    const source = createTestSource();

    const handle = await service.ensureHlsRuntime('cam-1', source);

    expect(transcoder.ensureHlsRuntime).toHaveBeenCalledWith('cam-1', {
      host: '192.168.1.20', rtspPort: 554, rtspPath: '/stream', username: 'admin', password: 'secret'
    });
    expect(handle).toEqual({ directory: '/tmp/homepilot-native-cameras/cam-1' });
  });

  it('delegates stopHlsRuntime by device id', () => {
    service.stopHlsRuntime('cam-1');
    expect(transcoder.stopHlsRuntime).toHaveBeenCalledWith('cam-1');
  });

  it('delegates snapshot streaming with the translated endpoint', () => {
    const source = createTestSource({ host: '10.0.0.9', rtspPort: 8554 });
    const fakeRes = {} as any;

    service.streamSnapshot(source, fakeRes);

    expect(transcoder.streamSnapshot).toHaveBeenCalledWith({
      host: '10.0.0.9', rtspPort: 8554, rtspPath: '/stream', username: 'admin', password: 'secret'
    }, fakeRes);
  });

  it('delegates MJPEG streaming with the translated endpoint', () => {
    const source = createTestSource();
    const fakeRes = {} as any;

    service.streamMjpeg(source, fakeRes);

    expect(transcoder.streamMjpeg).toHaveBeenCalledWith({
      host: '192.168.1.20', rtspPort: 554, rtspPath: '/stream', username: 'admin', password: 'secret'
    }, fakeRes);
  });
});
