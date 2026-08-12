import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SettingsRoutes } from '../routes/SettingsRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(body?: unknown): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/settings/home-assistant';
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = body === undefined ? undefined : JSON.stringify(body);
  return request;
}

function createContainer(isAdmin = true): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(true),
        requireRole: jest.fn().mockReturnValue(isAdmin),
      },
    },
    services: {
      homeAssistantSettingsService: {
        getStatus: jest.fn().mockResolvedValue({
          baseUrl: 'http://homeassistant.local:8123', hasToken: true, maskedToken: 'abcd••••wxyz',
          configurationStatus: 'configured', connectivityStatus: 'reachable', lastCheckedAt: '2026-08-11T12:00:00.000Z', activeSource: 'database',
        }),
        saveSettings: jest.fn().mockResolvedValue(undefined),
        testConnection: jest.fn().mockResolvedValue({ success: true, status: 'reachable' }),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: Home Assistant connection settings API', () => {
  it('Scenario: Given an authenticated user When the canonical test endpoint is called Then it tests without saving configuration', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();

    await routes.handle(createRequest({ baseUrl: 'http://ha.local', accessToken: 'token' }), new MockResponse() as unknown as http.ServerResponse, '/api/v1/settings/home-assistant/test', 'POST', container);

    expect(container.services.homeAssistantSettingsService.testConnection).toHaveBeenCalledWith('http://ha.local', 'token');
    expect(container.services.homeAssistantSettingsService.saveSettings).not.toHaveBeenCalled();
  });

  it('Scenario: Given an administrator When saving a URL without a replacement token Then it delegates the optional token unchanged', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();

    await routes.handle(createRequest({ baseUrl: 'http://ha.local' }), new MockResponse() as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'POST', container);

    expect(container.services.homeAssistantSettingsService.saveSettings).toHaveBeenCalledWith('http://ha.local', undefined);
  });

  it('Scenario: Given a caller When reading settings Then the response contains the masked status and never a raw token', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'GET', container);

    expect((response.end as jest.Mock).mock.calls[0][0]).toContain('abcd••••wxyz');
    expect((response.end as jest.Mock).mock.calls[0][0]).not.toContain('accessToken');
  });

  it('Scenario: Given an authenticated user When the status endpoint is called Then it returns only connection status and its timestamp', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/settings/home-assistant/status', 'GET', container);

    expect(JSON.parse((response.end as jest.Mock).mock.calls[0][0])).toEqual({
      connectivityStatus: 'reachable', lastCheckedAt: '2026-08-11T12:00:00.000Z',
    });
  });
});