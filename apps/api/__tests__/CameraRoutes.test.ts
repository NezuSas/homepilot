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
    expect(payload.streamPath).toContain('/camera/stream?token=camera-token');
    expect(payload.snapshotPath).toContain('/camera/snapshot?token=camera-token');
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
    const response = new MockResponse();
    const container = createContainer();
    const url = '/api/v1/devices/camera-1/camera/snapshot?token=camera-token';

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
      'camera-token',
      expect.any(AbortSignal),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
    }));
    expect(response.write).toHaveBeenCalled();
    expect(response.end).toHaveBeenCalled();
  });
});
