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
});
