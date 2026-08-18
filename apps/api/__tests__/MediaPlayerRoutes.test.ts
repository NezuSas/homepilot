import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaPlayerRoutes } from '../routes/MediaPlayerRoutes';

const mediaPlayer: Device = {
  id: 'media-1',
  homeId: 'home-1',
  roomId: 'tech',
  externalId: 'ha:media_player.office_screen',
  name: 'Pantalla Oficina',
  type: 'media_player',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: {
    state: 'playing',
    attributes: {
      entity_picture_local: '/api/media_player_proxy/media_player.office_screen?token=local-cover-token&cache=cover-version',
      entity_picture: 'https://cdn.example.invalid/cover.jpg',
    },
  },
  entityVersion: 1,
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
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
  request.user = { id: 'owner-1', username: 'owner', role: 'parent', displayName: null, avatarDataUri: null };
  return request;
}

function createContainer(): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: { deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(mediaPlayer) } },
    adapters: {
      homeAssistantClient: {
        getMediaArtwork: jest.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('MediaPlayerRoutes', () => {
  it('uses the authenticated local proxy path without persisting a short-lived Home Assistant artwork token', async () => {
    const routes = new MediaPlayerRoutes();
    const response = new MockResponse();

    await routes.handle(
      createRequest('/api/v1/devices/media-1/media/session'),
      response as unknown as http.ServerResponse,
      '/api/v1/devices/media-1/media/session',
      'GET',
      createContainer(),
    );

    const payload = JSON.parse(response.end.mock.calls[0][0] as string) as { artworkPath: string };
    expect(payload.artworkPath).toContain('/api/v1/devices/media-1/media/artwork?token=');
    expect(payload.artworkPath).not.toContain('local-cover-token');
    const signedToken = new URL(payload.artworkPath, 'http://localhost').searchParams.get('token') || '';
    const signedPayload = Buffer.from(signedToken.split('.')[0], 'base64url').toString('utf8');
    expect(signedPayload).toContain('/api/media_player_proxy/media_player.office_screen?cache=cover-version');
    expect(signedPayload).not.toContain('local-cover-token');
  });

  it('proxies artwork bytes only through a valid signed session', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const sessionResponse = new MockResponse();
    await routes.handle(
      createRequest('/api/v1/devices/media-1/media/session'),
      sessionResponse as unknown as http.ServerResponse,
      '/api/v1/devices/media-1/media/session',
      'GET',
      container,
    );
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
    const response = new MockResponse();
    const url = new URL(session.artworkPath, 'http://localhost');

    await routes.handle(
      createRequest(`${url.pathname}${url.search}`),
      response as unknown as http.ServerResponse,
      url.pathname,
      'GET',
      container,
    );

    expect(container.adapters.homeAssistantClient.getMediaArtwork).toHaveBeenCalledWith(
      '/api/media_player_proxy/media_player.office_screen?cache=cover-version',
      expect.any(AbortSignal),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'image/jpeg',
      'Content-Length': 3,
    }));
    expect(response.end).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
  });
  it('returns an empty artwork session for a player that has no available cover', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue({ ...mediaPlayer, lastKnownState: { state: 'idle' } });
    const response = new MockResponse();

    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), response as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);

    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ artworkPath: null }));
  });

  it('rejects an artwork request without a valid signed token before contacting Home Assistant', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest('/api/v1/devices/media-1/media/artwork?token=invalid'), response as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/artwork', 'GET', container);

    expect(container.adapters.homeAssistantClient.getMediaArtwork).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('UNAUTHORIZED'));
  });
});

describe('Feature: media artwork safety contracts', () => {
  it('does not reveal a media session when authentication fails or the target is not a media player', async () => {
    const routes = new MediaPlayerRoutes();
    const unauthenticated = createContainer();
    (unauthenticated.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);
    const unauthenticatedResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), unauthenticatedResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', unauthenticated);
    expect(unauthenticated.repositories.deviceRepository.findDeviceById).not.toHaveBeenCalled();

    const invalidDevice = createContainer();
    (invalidDevice.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue({ ...mediaPlayer, type: 'light' });
    const invalidResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), invalidResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', invalidDevice);
    expect(invalidResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(invalidResponse.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });

  it('maps invalid artwork upstream responses and transport failures to the proxy error contract', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const sessionResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
    const url = new URL(session.artworkPath, 'http://localhost');

    (container.adapters.homeAssistantClient.getMediaArtwork as jest.Mock).mockResolvedValue(new Response('not an image', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    const invalidResponse = new MockResponse();
    await routes.handle(createRequest(`${url.pathname}${url.search}`), invalidResponse as unknown as http.ServerResponse, url.pathname, 'GET', container);
    expect(invalidResponse.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(invalidResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));

    (container.adapters.homeAssistantClient.getMediaArtwork as jest.Mock).mockRejectedValue(new Error('upstream offline'));
    const failedResponse = new MockResponse();
    await routes.handle(createRequest(`${url.pathname}${url.search}`), failedResponse as unknown as http.ServerResponse, url.pathname, 'GET', container);
    expect(failedResponse.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(failedResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));
  });
});
describe('Feature: media artwork token and disconnect safeguards', () => {
  it('Scenario: Given an artwork token issued for another device When artwork is requested Then no upstream media request is made', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const sessionResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
    const token = new URL(session.artworkPath, 'http://localhost').searchParams.get('token');
    const response = new MockResponse();

    await routes.handle(createRequest(`/api/v1/devices/media-2/media/artwork?token=${encodeURIComponent(token || '')}`), response as unknown as http.ServerResponse, '/api/v1/devices/media-2/media/artwork', 'GET', container);

    expect(container.adapters.homeAssistantClient.getMediaArtwork).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  });

  it('Scenario: Given the client disconnects while artwork is fetched When the upstream responds Then no bytes are written to the disconnected response', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const sessionResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
    const url = new URL(session.artworkPath, 'http://localhost');
    const response = new MockResponse();
    response.destroyed = true;

    await routes.handle(createRequest(`${url.pathname}${url.search}`), response as unknown as http.ServerResponse, url.pathname, 'GET', container);

    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });
});
describe('Feature: media route boundaries', () => {
  it('returns false for unrelated paths without authenticating or contacting Home Assistant', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await expect(routes.handle(createRequest('/api/v1/devices/media-1/state'), response as unknown as http.ServerResponse, '/api/v1/devices/media-1/state', 'GET', container)).resolves.toBe(false);

    expect(container.guards.authGuard.protect).not.toHaveBeenCalled();
    expect(container.adapters.homeAssistantClient.getMediaArtwork).not.toHaveBeenCalled();
  });
});
describe('Feature: media artwork normalization and token lifetime', () => {
  it('issues a session for an external media image when the local Home Assistant path is absent', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue({
      ...mediaPlayer,
      lastKnownState: { state: 'playing', attributes: { entity_picture: 'https://cdn.example.invalid/cover.jpg' } },
    });
    const response = new MockResponse();

    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), response as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);

    const session = JSON.parse(response.end.mock.calls[0][0] as string) as { artworkPath: string };
    const token = new URL(session.artworkPath, 'http://localhost').searchParams.get('token') || '';
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { artworkPath: string };
    expect(payload.artworkPath).toBe('https://cdn.example.invalid/cover.jpg');
  });

  it('uses a valid artwork field on the state object and rejects expired sessions before contacting Home Assistant', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    try {
      const routes = new MediaPlayerRoutes();
      const container = createContainer();
      (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue({
        ...mediaPlayer,
        lastKnownState: { state: 'playing', entity_picture_local: '/api/media_player_proxy/media_player.fallback?token=old' },
      });
      const sessionResponse = new MockResponse();
      await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);
      const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
      const url = new URL(session.artworkPath, 'http://localhost');

      jest.setSystemTime(new Date('2026-08-17T00:31:00.000Z'));
      const expiredResponse = new MockResponse();
      await routes.handle(createRequest(`${url.pathname}${url.search}`), expiredResponse as unknown as http.ServerResponse, url.pathname, 'GET', container);

      expect(container.adapters.homeAssistantClient.getMediaArtwork).not.toHaveBeenCalled();
      expect(expiredResponse.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects empty or non-image upstream artwork responses with the stable proxy error', async () => {
    const routes = new MediaPlayerRoutes();
    const container = createContainer();
    const sessionResponse = new MockResponse();
    await routes.handle(createRequest('/api/v1/devices/media-1/media/session'), sessionResponse as unknown as http.ServerResponse, '/api/v1/devices/media-1/media/session', 'GET', container);
    const session = JSON.parse(sessionResponse.end.mock.calls[0][0] as string) as { artworkPath: string };
    const url = new URL(session.artworkPath, 'http://localhost');
    (container.adapters.homeAssistantClient.getMediaArtwork as jest.Mock).mockResolvedValue(new Response(null, { status: 204, headers: { 'Content-Type': 'image/jpeg' } }));
    const response = new MockResponse();

    await routes.handle(createRequest(`${url.pathname}${url.search}`), response as unknown as http.ServerResponse, url.pathname, 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));
  });
});