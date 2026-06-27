import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { CameraRoutes } from '../routes/CameraRoutes';

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

  it('creates an authenticated media session without exposing the HA admin token', async () => {
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
    expect(payload.hlsPath).toContain('/camera/hls/master.m3u8?token=');
    expect(payload.streamPath).not.toContain('camera-token');
    expect(payload.snapshotPath).not.toContain('camera-token');
    expect(payload.hlsPath).not.toContain('/api/hls/upstream/');
  });

  it('returns a camera unavailable response when Home Assistant reports unavailable', async () => {
    const response = new MockResponse();

    await routes.handle(
      createRequest('/api/v1/devices/camera-1/camera/session'),
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
      createRequest('/api/v1/devices/camera-1/camera/session'),
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
      createRequest('/api/v1/devices/camera-1/camera/session'),
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
});
