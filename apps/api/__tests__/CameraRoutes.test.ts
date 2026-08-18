import { EventEmitter } from 'events';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { CameraRoutes } from '../routes/CameraRoutes';
import type { NativeCameraSource, NativeCameraSourceRepository } from '../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import { NativeCameraStreamingService } from '../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import type { MediaTranscoderPort } from '../../../packages/integrations/native-camera/application/ports/MediaTranscoderPort';

const cameraDevice: Device = {
  id: 'camera-1',
  homeId: 'home-1',
  roomId: 'garden',
  externalId: 'ha:camera.ingreso',
  name: 'Camara de ingreso',
  type: 'camera',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: { state: 'idle' },
  entityVersion: 1,
  createdAt: '2026-06-26T00:00:00.000Z',
  updatedAt: '2026-06-26T00:00:00.000Z',
};

class MockResponse extends EventEmitter {
  public destroyed = false;
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly write = jest.fn().mockReturnValue(true);
  public readonly end = jest.fn().mockReturnThis();
}

function createRequest(url: string): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = {};
  request.user = { id: 'user-1', username: 'owner', role: 'parent', displayName: null, avatarDataUri: null };
  return request;
}

function createContainer(overrides?: {
  state?: 'idle' | 'unavailable';
  mediaResponse?: Response;
  hlsStreamPath?: string | null;
  hlsMediaResponse?: (path: string) => Response;
}): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(true),
      },
    },
    repositories: {
      deviceRepository: {
        findDeviceById: jest.fn().mockResolvedValue(cameraDevice),
      },
    },
    adapters: {
      homeAssistantClient: {
        getEntityState: jest.fn().mockResolvedValue({
          entity_id: 'camera.ingreso',
          state: overrides?.state || 'idle',
          attributes: {
            entity_picture: '/api/camera_proxy/camera.ingreso?token=camera-token',
          },
          last_changed: '2026-06-26T00:00:00.000Z',
          last_updated: '2026-06-26T00:00:00.000Z',
        }),
        getCameraMedia: jest.fn().mockResolvedValue(
          overrides?.mediaResponse || new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          }),
        ),
        getCameraHlsStreamPath: jest.fn().mockResolvedValue(
          overrides?.hlsStreamPath === undefined
            ? '/api/hls/upstream/master_playlist.m3u8'
            : overrides.hlsStreamPath,
        ),
        getCameraHlsMedia: jest.fn().mockImplementation((path: string) => (
          overrides?.hlsMediaResponse?.(path)
          || new Response('#EXTM3U\n#EXTINF:2,\nsegment-1.ts\n', {
            status: 200,
            headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
          })
        )),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('CameraRoutes', () => {
  const routes = new CameraRoutes();

  it('creates an authenticated fast media session without starting HLS', async () => {
    const response = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    expect(container.guards.authGuard.protect).toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.streamPath).toContain('/camera/stream?token=');
    expect(payload.snapshotPath).toContain('/camera/snapshot?token=');
    expect(payload.hlsPath).toBeUndefined();
    expect(payload.streamPath).not.toContain('camera-token');
    expect(payload.snapshotPath).not.toContain('camera-token');
    expect(container.adapters.homeAssistantClient.getCameraHlsStreamPath).not.toHaveBeenCalled();
  });

  it('creates an HLS session by default for a native camera', async () => {
    const response = new MockResponse();
    const nativeCamera: Device = {
      ...cameraDevice,
      externalId: 'native:camera-1',
      integrationSource: 'native-camera',
      vendor: 'native-camera',
    };
    const nativeSource: NativeCameraSource = {
      deviceId: nativeCamera.id,
      homeId: nativeCamera.homeId,
      sourceType: 'onvif-ptz',
      name: nativeCamera.name,
      host: '192.168.1.56',
      onvifPort: 8000,
      rtspPort: 554,
      username: 'admin',
      password: 'secret',
      rtspPath: '/stream',
      enabled: true,
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:00.000Z',
      profileToken: null,
      ptzConfigurationToken: null,
      ptzSupported: false,
    };
    const nativeCameraSourceRepository: NativeCameraSourceRepository = {
      findByDeviceId: jest.fn().mockReturnValue(nativeSource),
      findByHomeId: jest.fn().mockReturnValue([nativeSource]),
      findDuplicate: jest.fn().mockReturnValue(null),
      save: jest.fn(),
    };
    const mediaTranscoder: MediaTranscoderPort = {
      ensureHlsRuntime: jest.fn().mockResolvedValue({ directory: '/tmp/homepilot-native-cameras/camera-1' }),
      stopHlsRuntime: jest.fn(),
      streamSnapshot: jest.fn(),
      streamMjpeg: jest.fn(),
    };
    const nativeCameraStreamingService = new NativeCameraStreamingService(mediaTranscoder);
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(nativeCamera);
    const routes = new CameraRoutes(nativeCameraSourceRepository, nativeCameraStreamingService);

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.hlsPath).toContain('/camera/hls/master.m3u8?token=');
    expect(mediaTranscoder.ensureHlsRuntime).toHaveBeenCalledWith('camera-1', {
      host: nativeSource.host,
      rtspPort: nativeSource.rtspPort,
      rtspPath: nativeSource.rtspPath,
      username: nativeSource.username,
      password: nativeSource.password,
    });
  });
  it('includes proxied HLS only when the viewer explicitly requests it', async () => {
    const response = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.hlsPath).toContain('/camera/hls/master.m3u8?token=');
    expect(payload.hlsPath).not.toContain('/api/hls/upstream/');
    expect(container.adapters.homeAssistantClient.getCameraHlsStreamPath).toHaveBeenCalledWith('camera.ingreso');
  });

  it('returns a camera unavailable response when Home Assistant reports unavailable', async () => {
    const response = new MockResponse();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      createContainer({ state: 'unavailable' }),
    );

    expect(response.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'application/json' });
  });

  it('proxies camera bytes and preserves the upstream content type', async () => {
    const sessionResponse = new MockResponse();
    const response = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const payload = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const url = payload.snapshotPath;

    await routes.handle(
      createRequest(url),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );

    expect(container.adapters.homeAssistantClient.getCameraMedia).toHaveBeenCalledWith(
      'camera.ingreso',
      'snapshot',
      expect.any(AbortSignal),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    }));
    expect(response.write).toHaveBeenCalled();
    expect(response.end).toHaveBeenCalled();
  });

  it('preserves an upstream media length and maps transport failures to the camera media contract', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const failureResponse = new MockResponse();
    const container = createContainer({
      mediaResponse: new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3' },
      }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;

    await routes.handle(
      createRequest(session.snapshotPath),
      mediaResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );
    expect(mediaResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Length': '3' }));

    (container.adapters.homeAssistantClient.getCameraMedia as jest.Mock).mockRejectedValueOnce(new Error('camera transport unavailable'));
    await routes.handle(
      createRequest(session.snapshotPath),
      failureResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );

    expect(failureResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(failureResponse.end).toHaveBeenCalledWith(expect.stringContaining('camera transport unavailable'));
  });
  it('rewrites HLS manifests and proxies their registered segments', async () => {
    const sessionResponse = new MockResponse();
    const manifestResponse = new MockResponse();
    const segmentResponse = new MockResponse();
    const container = createContainer({
      hlsMediaResponse: (path) => path.endsWith('.ts')
        ? new Response(new Uint8Array([4, 5, 6]), {
            status: 200,
            headers: { 'Content-Type': 'video/mp2t' },
          })
        : new Response('#EXTM3U\n#EXTINF:2,\nsegment-1.ts\n', {
            status: 200,
            headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
          }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    await routes.handle(
      createRequest(session.hlsPath),
      manifestResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    const manifest = manifestResponse.end.mock.calls[0][0] as string;
    const segmentPath = manifest.split('\n').find((line) => line.startsWith('/api/v1/devices/'));
    expect(segmentPath).toContain('/camera/hls/resource/');
    expect(manifest).not.toContain('/api/hls/upstream/');

    const segmentUrl = new URL(segmentPath as string, 'http://localhost');
    await routes.handle(
      createRequest(`${segmentUrl.pathname}${segmentUrl.search}`),
      segmentResponse as unknown as http.ServerResponse,
      segmentUrl.pathname,
      'GET',
      container,
    );

    expect(container.adapters.homeAssistantClient.getCameraHlsMedia).toHaveBeenCalledWith(
      '/api/hls/upstream/segment-1.ts',
      expect.any(AbortSignal),
    );
    expect(segmentResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'video/mp2t',
    }));
    expect(segmentResponse.write).toHaveBeenCalled();
  });
  it('keeps snapshot and stream paths available when the optional HLS lookup rejects', async () => {
    const response = new MockResponse();
    const container = createContainer();
    (container.adapters.homeAssistantClient.getCameraHlsStreamPath as jest.Mock).mockRejectedValue(new Error('HLS unavailable'));

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.snapshotPath).toContain('/camera/snapshot?token=');
    expect(payload.streamPath).toContain('/camera/stream?token=');
    expect(payload.hlsPath).toBeUndefined();
    expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
  });
  it('keeps a camera session usable when Home Assistant has no HLS path', async () => {
    const response = new MockResponse();
    const container = createContainer({ hlsStreamPath: null });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as Record<string, string>;
    expect(payload.snapshotPath).toContain('/camera/snapshot?token=');
    expect(payload.hlsPath).toBeUndefined();
    expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
  });

  it('maps upstream authentication rejection to an unauthorized camera response', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const container = createContainer({
      mediaResponse: new Response(null, { status: 401, headers: { 'Content-Type': 'application/json' } }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;

    await routes.handle(
      createRequest(session.snapshotPath),
      mediaResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );

    expect(mediaResponse.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(mediaResponse.end).toHaveBeenCalledWith(expect.stringContaining('UNAUTHORIZED'));
  });
  it('rejects a validly signed HLS token once its server-side session has expired', async () => {
    const sessionResponse = new MockResponse();
    const expiredResponse = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const token = new URL(session.hlsPath, 'http://localhost').searchParams.get('token');
    const hlsSessions = (routes as unknown as { hlsSessions: Map<string, { expiresAt: number }> }).hlsSessions;
    hlsSessions.get(token as string)!.expiresAt = Date.now() - 1;

    await routes.handle(
      createRequest(session.hlsPath),
      expiredResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    expect(expiredResponse.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(expiredResponse.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_SESSION_EXPIRED'));
    expect(hlsSessions.has(token as string)).toBe(false);
  });

  it('rejects an HLS resource identifier that was not issued for the session', async () => {
    const sessionResponse = new MockResponse();
    const resourceResponse = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const token = new URL(session.hlsPath, 'http://localhost').searchParams.get('token');

    await routes.handle(
      createRequest(`/api/v1/devices/camera-1/camera/hls/resource/not-issued?token=${encodeURIComponent(token as string)}`),
      resourceResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/resource/not-issued',
      'GET',
      container,
    );

    expect(resourceResponse.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(resourceResponse.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_HLS_RESOURCE_NOT_FOUND'));
    expect(container.adapters.homeAssistantClient.getCameraHlsMedia).not.toHaveBeenCalled();
  });
  it('rejects media and HLS proxy requests without a valid short-lived camera token', async () => {
    const mediaResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer();

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/snapshot'), mediaResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/snapshot', 'GET', container);
    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/hls/master.m3u8?token=invalid'), hlsResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/hls/master.m3u8', 'GET', container);

    expect(mediaResponse.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(hlsResponse.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
  });
  it('stops a session request when the authentication guard rejects it', async () => {
    const response = new MockResponse();
    const container = createContainer();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);

    await expect(routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    )).resolves.toBe(true);

    expect(container.repositories.deviceRepository.findDeviceById).not.toHaveBeenCalled();
    expect(response.writeHead).not.toHaveBeenCalled();
  });

  it('returns device not found when creating a session for an unknown camera', async () => {
    const response = new MockResponse();
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(null);

    await routes.handle(
      createRequest('/api/v1/devices/missing/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/missing/camera/session',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
  });

  it('rejects a proxied camera response with an unsafe content type', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const container = createContainer({
      mediaResponse: new Response('<html>error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;

    await routes.handle(
      createRequest(session.snapshotPath),
      mediaResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );

    expect(mediaResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
  });
  it('maps an upstream authentication rejection to the camera authorization contract', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const container = createContainer({
      mediaResponse: new Response(null, { status: 401, headers: { 'Content-Type': 'application/json' } }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;

    await routes.handle(
      createRequest(session.snapshotPath),
      mediaResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/snapshot',
      'GET',
      container,
    );

    expect(mediaResponse.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(mediaResponse.end).toHaveBeenCalledWith(expect.stringContaining('UNAUTHORIZED'));
  });
  it('returns false for a route outside the camera contract', async () => {
    const response = new MockResponse();

    const handled = await routes.handle(
      createRequest('/api/v1/devices/camera-1/unknown'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/unknown',
      'GET',
      createContainer(),
    );

    expect(handled).toBe(false);
  });

  it('does not create a session for a device that is not a camera entity', async () => {
    const response = new MockResponse();
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue({ ...cameraDevice, type: 'sensor', externalId: 'ha:sensor.temperature' });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });

  it('maps an upstream HLS failure to a safe media response', async () => {
    const sessionResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer({
      hlsMediaResponse: () => new Response(null, { status: 503, headers: { 'Content-Type': 'application/json' } }),
    });

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    await routes.handle(
      createRequest(session.hlsPath),
      hlsResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    expect(hlsResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(hlsResponse.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_MEDIA_ERROR'));
  });

  it('reports an unavailable native camera when no enabled source is configured', async () => {
    const response = new MockResponse();
    const nativeCamera: Device = { ...cameraDevice, externalId: 'native:camera-1', integrationSource: 'native-camera', vendor: 'native-camera' };
    const nativeSources: NativeCameraSourceRepository = {
      findByDeviceId: jest.fn().mockReturnValue(null),
      findByHomeId: jest.fn().mockReturnValue([]),
      findDuplicate: jest.fn().mockReturnValue(null),
      save: jest.fn(),
    };
    const streaming = { ensureHlsRuntime: jest.fn(), stopHlsRuntime: jest.fn(), streamSnapshot: jest.fn(), streamMjpeg: jest.fn() } as unknown as NativeCameraStreamingService;
    const nativeRoutes = new CameraRoutes(nativeSources, streaming);
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(nativeCamera);

    await nativeRoutes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_UNAVAILABLE'));
  });
  it('maps a Home Assistant session lookup failure to a safe media error', async () => {
    const response = new MockResponse();
    const container = createContainer();
    (container.adapters.homeAssistantClient.getEntityState as jest.Mock).mockRejectedValue(new Error('HA offline'));

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_MEDIA_ERROR'));
  });

  it('maps native session authentication and startup failures to their public contracts', async () => {
    const nativeCamera: Device = { ...cameraDevice, externalId: 'native:camera-1', integrationSource: 'native-camera', vendor: 'native-camera' };
    const source: NativeCameraSource = {
      deviceId: nativeCamera.id, homeId: nativeCamera.homeId, sourceType: 'rtsp-dvr', name: nativeCamera.name,
      host: '192.168.1.35', onvifPort: 80, rtspPort: 554, username: 'admin', password: 'secret', rtspPath: '/stream',
      enabled: true, createdAt: '2026-06-26T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z',
      profileToken: null, ptzConfigurationToken: null, ptzSupported: false,
    };
    const sourceRepository: NativeCameraSourceRepository = {
      findByDeviceId: jest.fn().mockReturnValue(source), findByHomeId: jest.fn().mockReturnValue([source]),
      findDuplicate: jest.fn().mockReturnValue(null), save: jest.fn(),
    };
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(nativeCamera);

    for (const [errorMessage, expectedCode, expectedStatus] of [
      ['NATIVE_CAMERA_AUTH_FAILED', 'NATIVE_CAMERA_AUTH_FAILED', 400],
      ['NATIVE_CAMERA_STREAM_TIMEOUT', 'NATIVE_CAMERA_STREAM_TIMEOUT', 502],
    ] as const) {
      const response = new MockResponse();
      const streaming = {
        ensureHlsRuntime: jest.fn().mockRejectedValue(new Error(errorMessage)),
        stopHlsRuntime: jest.fn(), streamSnapshot: jest.fn(), streamMjpeg: jest.fn(),
      } as unknown as NativeCameraStreamingService;
      const nativeRoutes = new CameraRoutes(sourceRepository, streaming);

      await nativeRoutes.handle(
        createRequest('/api/v1/devices/camera-1/camera/session'), response as unknown as http.ServerResponse,
        '/api/v1/devices/camera-1/camera/session', 'GET', container,
      );

      expect(response.writeHead).toHaveBeenCalledWith(expectedStatus, { 'Content-Type': 'application/json' });
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining(expectedCode));
    }
  });

  it('delegates native snapshots and MJPEG streams only after validating the source', async () => {
    const nativeCamera: Device = { ...cameraDevice, externalId: 'native:camera-1', integrationSource: 'native-camera', vendor: 'native-camera' };
    const source: NativeCameraSource = {
      deviceId: nativeCamera.id, homeId: nativeCamera.homeId, sourceType: 'rtsp-dvr', name: nativeCamera.name,
      host: '192.168.1.35', onvifPort: 80, rtspPort: 554, username: 'admin', password: 'secret', rtspPath: '/stream',
      enabled: true, createdAt: '2026-06-26T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z',
      profileToken: null, ptzConfigurationToken: null, ptzSupported: false,
    };
    const sourceRepository: NativeCameraSourceRepository = {
      findByDeviceId: jest.fn().mockReturnValue(source), findByHomeId: jest.fn().mockReturnValue([source]),
      findDuplicate: jest.fn().mockReturnValue(null), save: jest.fn(),
    };
    const streaming = {
      ensureHlsRuntime: jest.fn().mockResolvedValue({ directory: '/tmp/camera-1' }),
      stopHlsRuntime: jest.fn(), streamSnapshot: jest.fn(), streamMjpeg: jest.fn(),
    } as unknown as NativeCameraStreamingService;
    const nativeRoutes = new CameraRoutes(sourceRepository, streaming);
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(nativeCamera);
    const sessionResponse = new MockResponse();

    await nativeRoutes.handle(createRequest('/api/v1/devices/camera-1/camera/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    await nativeRoutes.handle(createRequest(session.snapshotPath), new MockResponse() as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/snapshot', 'GET', container);
    await nativeRoutes.handle(createRequest(session.streamPath), new MockResponse() as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/stream', 'GET', container);

    expect(streaming.streamSnapshot).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'camera-1' }), expect.anything());
    expect(streaming.streamMjpeg).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'camera-1' }), expect.anything());
  });
  it('rejects a valid token that requests an HLS resource not registered by its manifest', async () => {
    const sessionResponse = new MockResponse();
    const resourceResponse = new MockResponse();
    const container = createContainer();

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const token = new URL(session.hlsPath, 'http://localhost').searchParams.get('token');

    await routes.handle(
      createRequest(`/api/v1/devices/camera-1/camera/hls/resource/not-registered?token=${encodeURIComponent(token ?? '')}`),
      resourceResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/resource/not-registered',
      'GET',
      container,
    );

    expect(resourceResponse.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(resourceResponse.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_HLS_RESOURCE_NOT_FOUND'));
  });

  it('contains invalid upstream HLS references instead of exposing arbitrary media URLs', async () => {
    const sessionResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer({
      hlsMediaResponse: () => new Response('#EXTM3U\nhttps://untrusted.example/segment.ts\n', {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
      }),
    });

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    await routes.handle(createRequest(session.hlsPath), hlsResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/hls/master.m3u8', 'GET', container);

    expect(hlsResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(hlsResponse.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_HLS_RESOURCE_INVALID'));
  });

  it('aborts an in-flight Home Assistant media request when the client closes the stream', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const container = createContainer();
    let capturedSignal: AbortSignal | undefined;
    let rejectUpstream: ((reason?: unknown) => void) | undefined;
    (container.adapters.homeAssistantClient.getCameraMedia as jest.Mock).mockImplementation(
      (_entityId: string, _kind: string, signal: AbortSignal) => new Promise<Response>((_resolve, reject) => {
        capturedSignal = signal;
        rejectUpstream = reject;
      }),
    );

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const pending = routes.handle(createRequest(session.streamPath), mediaResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/stream', 'GET', container);

    await Promise.resolve();
    mediaResponse.emit('close');
    rejectUpstream?.(new Error('client disconnected'));
    await pending;

    expect(capturedSignal?.aborted).toBe(true);
    expect(mediaResponse.writeHead).not.toHaveBeenCalled();
  });
  it('aborts an in-flight Home Assistant HLS request when the viewer closes the stream', async () => {
    const sessionResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer();
    let capturedSignal: AbortSignal | undefined;
    let rejectUpstream: ((reason?: unknown) => void) | undefined;
    (container.adapters.homeAssistantClient.getCameraHlsMedia as jest.Mock).mockImplementation(
      (_path: string, signal: AbortSignal) => new Promise<Response>((_resolve, reject) => {
        capturedSignal = signal;
        rejectUpstream = reject;
      }),
    );

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const pending = routes.handle(createRequest(session.hlsPath), hlsResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/hls/master.m3u8', 'GET', container);

    await Promise.resolve();
    hlsResponse.emit('close');
    rejectUpstream?.(new Error('viewer disconnected'));
    await pending;

    expect(capturedSignal?.aborted).toBe(true);
    expect(hlsResponse.writeHead).not.toHaveBeenCalled();
  });
  it('maps transport failures while proxying camera media to a stable media error', async () => {
    const sessionResponse = new MockResponse();
    const mediaResponse = new MockResponse();
    const container = createContainer();
    (container.adapters.homeAssistantClient.getCameraMedia as jest.Mock).mockRejectedValue(new Error('camera transport failed'));

    await routes.handle(createRequest('/api/v1/devices/camera-1/camera/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    await routes.handle(createRequest(session.streamPath), mediaResponse as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/stream', 'GET', container);

    expect(mediaResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(mediaResponse.end).toHaveBeenCalledWith(expect.stringContaining('camera transport failed'));
  });
  it('rejects unauthenticated camera media requests before resolving the device or upstream stream', async () => {
    const response = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/stream'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/stream',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Missing camera access token'));
    expect(container.repositories.deviceRepository.findDeviceById).not.toHaveBeenCalled();
    expect(container.adapters.homeAssistantClient.getCameraMedia).not.toHaveBeenCalled();
  });
  it('rejects an expired HLS session without contacting the upstream camera', async () => {
    const response = new MockResponse();
    const container = createContainer();
    const internals = routes as unknown as {
      createCameraProxyToken(deviceId: string): string;
      registerHlsSession(token: string, deviceId: string, masterPath: string, source: 'home-assistant'): void;
      hlsSessions: Map<string, { expiresAt: number }>;
    };
    const token = internals.createCameraProxyToken('camera-1');
    internals.registerHlsSession(token, 'camera-1', '/api/hls/master.m3u8', 'home-assistant');
    internals.hlsSessions.get(token)!.expiresAt = Date.now() - 1;

    await routes.handle(
      createRequest(`/api/v1/devices/camera-1/camera/hls/master.m3u8?token=${encodeURIComponent(token)}`),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('CAMERA_SESSION_EXPIRED'));
    expect(container.adapters.homeAssistantClient.getCameraHlsMedia).not.toHaveBeenCalled();
  });
  it('keeps HLS proxy tokens, camera identities, and rewritten resources scoped to the selected camera', () => {
    const internals = routes as unknown as {
      createCameraProxyToken(deviceId: string): string;
      verifyCameraProxyToken(token: string, deviceId: string): boolean;
      resolveCameraEntityId(device: Device | null): string | null;
      registerHlsSession(token: string, deviceId: string, masterPath: string, source: 'home-assistant'): void;
      hlsSessions: Map<string, { deviceId: string; resourcesById: Map<string, string>; resourceIdsByPath: Map<string, string> }>;
      rewriteHlsManifest(manifest: string, currentPath: string, session: { deviceId: string; resourcesById: Map<string, string>; resourceIdsByPath: Map<string, string> }, token: string): string;
      resolveHlsPath(currentPath: string, uri: string): string;
    };
    const token = internals.createCameraProxyToken('camera-1');

    expect(internals.verifyCameraProxyToken(token, 'camera-1')).toBe(true);
    expect(internals.verifyCameraProxyToken(token, 'camera-2')).toBe(false);
    expect(internals.verifyCameraProxyToken('invalid', 'camera-1')).toBe(false);
    expect(internals.resolveCameraEntityId(null)).toBeNull();
    expect(internals.resolveCameraEntityId({ ...cameraDevice, externalId: 'ha:light.office' })).toBeNull();
    expect(internals.resolveCameraEntityId({ ...cameraDevice, integrationSource: 'native-camera', type: 'camera' })).toBe('native');

    internals.registerHlsSession(token, 'camera-1', '/api/hls/master.m3u8', 'home-assistant');
    const session = internals.hlsSessions.get(token)!;
    const rewritten = internals.rewriteHlsManifest('#EXTM3U\n#EXT-X-MEDIA:URI="audio.m3u8"\nsegment.ts\ndata:text/plain,ignored', '/api/hls/master.m3u8', session, token);
    expect(rewritten).toContain('/camera/hls/resource/');
    expect(rewritten).toContain('data:text/plain,ignored');
    expect(session.resourcesById.size).toBe(2);
    expect(internals.resolveHlsPath('/api/hls/master.m3u8', 'segment.ts')).toBe('/api/hls/segment.ts');
    expect(() => internals.resolveHlsPath('/api/hls/master.m3u8', 'https://untrusted.example/segment.ts')).toThrow('CAMERA_HLS_RESOURCE_INVALID');
  });
  it('serves native HLS manifests from the registered directory and rejects traversal paths', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-camera-test-'));
    const manifestPath = path.join(tempDirectory, 'index.m3u8');
    const segmentPath = path.join(tempDirectory, 'segment-1.ts');
    fs.writeFileSync(manifestPath, '#EXTM3U\nsegment-1.ts\n');
    fs.writeFileSync(segmentPath, 'segment');
    const nativeRoutes = new CameraRoutes();
    const internals = nativeRoutes as unknown as {
      createCameraProxyToken(deviceId: string): string;
      registerHlsSession(token: string, deviceId: string, masterPath: string, source: 'native', nativeDirectory: string): void;
      hlsSessions: Map<string, { deviceId: string; expiresAt: number; source: 'native'; masterPath: string; resourcesById: Map<string, string>; resourceIdsByPath: Map<string, string>; nativeDirectory: string }>;
      serveNativeHlsResource(res: http.ServerResponse, session: unknown, filePath: string): Promise<void>;
    };
    const token = internals.createCameraProxyToken('camera-1');
    internals.registerHlsSession(token, 'camera-1', manifestPath, 'native', tempDirectory);
    const session = internals.hlsSessions.get(token)!;
    const manifestResponse = new MockResponse();
    const invalidResponse = new MockResponse();

    try {
      await internals.serveNativeHlsResource(manifestResponse as unknown as http.ServerResponse, session, manifestPath);
      const manifest = manifestResponse.end.mock.calls[0][0] as string;
      expect(manifestResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'application/vnd.apple.mpegurl' }));
      expect(manifest).toContain('/camera/hls/resource/segment-1.ts?token=');
      expect(session.resourcesById.get('segment-1.ts')).toBe(segmentPath);

      await internals.serveNativeHlsResource(invalidResponse as unknown as http.ServerResponse, session, path.join(tempDirectory, '..', 'outside.ts'));
      expect(invalidResponse.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('uses the route fallback when a media request has no raw URL', async () => {
    const response = new MockResponse();
    const request = createRequest('/unused');
    request.url = undefined;
    const container = createContainer();

    await routes.handle(request, response as unknown as http.ServerResponse, '/api/v1/devices/camera-1/camera/stream', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Missing camera access token'));
    expect(container.repositories.deviceRepository.findDeviceById).not.toHaveBeenCalled();
  });

  it('contains an HLS transport failure in the stable camera media contract', async () => {
    const sessionResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer();
    (container.adapters.homeAssistantClient.getCameraHlsMedia as jest.Mock)
      .mockRejectedValue(new Error('HLS transport failed'));

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;

    await routes.handle(
      createRequest(session.hlsPath),
      hlsResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    expect(hlsResponse.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(hlsResponse.end).toHaveBeenCalledWith(expect.stringContaining('HLS transport failed'));
  });

  it('renews an active HLS session while the viewer keeps requesting its manifest', async () => {
    const sessionResponse = new MockResponse();
    const hlsResponse = new MockResponse();
    const container = createContainer();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session?includeHls=true'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as Record<string, string>;
    const token = new URL(session.hlsPath, 'http://localhost').searchParams.get('token')!;
    const hlsSessions = (routes as unknown as { hlsSessions: Map<string, { expiresAt: number }> }).hlsSessions;
    const beforeRequest = hlsSessions.get(token)!.expiresAt;

    await routes.handle(
      createRequest(session.hlsPath),
      hlsResponse as unknown as http.ServerResponse,
      '/api/v1/devices/camera-1/camera/hls/master.m3u8',
      'GET',
      container,
    );

    expect(hlsSessions.get(token)!.expiresAt).toBeGreaterThanOrEqual(beforeRequest);
    expect(hlsResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'application/vnd.apple.mpegurl',
    }));
  });
});
