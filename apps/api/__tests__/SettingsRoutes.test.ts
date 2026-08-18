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

  it('Scenario: Given a protected request without a session When settings are targeted Then it stops before services are called', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    container.guards.authGuard.protect = jest.fn().mockResolvedValue(false);

    await expect(routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'GET', container)).resolves.toBe(true);
    expect(container.services.homeAssistantSettingsService.getStatus).not.toHaveBeenCalled();
  });

  it('Scenario: Given incomplete connection test data When testing Then it returns validation without calling Home Assistant', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest({ baseUrl: 'http://ha.local' }), response as unknown as http.ServerResponse, '/api/v1/settings/home-assistant/test', 'POST', container);

    expect(container.services.homeAssistantSettingsService.testConnection).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
  });

  it('Scenario: Given a failed connection test When testing Then it returns the service status as a safe error', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    const response = new MockResponse();
    container.services.homeAssistantSettingsService.testConnection = jest.fn().mockResolvedValue({ success: false, status: 'unreachable', error: 'Timed out' });

    await routes.handle(createRequest({ baseUrl: 'http://ha.local', accessToken: 'token' }), response as unknown as http.ServerResponse, '/api/v1/settings/test-ha-connection', 'POST', container);

    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('UNREACHABLE'));
  });

  it('Scenario: Given a non-administrator When saving settings Then it does not persist changes', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer(false);

    await routes.handle(createRequest({ baseUrl: 'http://ha.local' }), new MockResponse() as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'POST', container);

    expect(container.services.homeAssistantSettingsService.saveSettings).not.toHaveBeenCalled();
  });

  it('Scenario: Given an invalid Home Assistant URL When saving Then it reports validation instead of an internal error', async () => {
    const routes = new SettingsRoutes();
    const container = createContainer();
    const response = new MockResponse();
    container.services.homeAssistantSettingsService.saveSettings = jest.fn().mockRejectedValue(new Error('Invalid URL'));

    await routes.handle(createRequest({ baseUrl: 'not-a-url' }), response as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Invalid Home Assistant URL'));
  });

  it('Scenario: Given an unrelated path When settings routes receive it Then they decline it', async () => {
    const routes = new SettingsRoutes();

    await expect(routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/devices', 'GET', createContainer())).resolves.toBe(false);
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
describe('Feature: Home Assistant settings failure contracts', () => {
  it('returns safe errors for unexpected test, save, and status failures', async () => {
    const routes = new SettingsRoutes();

    const testContainer = createContainer();
    testContainer.services.homeAssistantSettingsService.testConnection = jest.fn().mockRejectedValue(new Error('transport details'));
    const testResponse = new MockResponse();
    await routes.handle(createRequest({ baseUrl: 'http://ha.local', accessToken: 'token' }), testResponse as unknown as http.ServerResponse, '/api/v1/settings/home-assistant/test', 'POST', testContainer);
    expect(testResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(testResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));

    const saveContainer = createContainer();
    saveContainer.services.homeAssistantSettingsService.saveSettings = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const saveResponse = new MockResponse();
    await routes.handle(createRequest({ baseUrl: 'http://ha.local' }), saveResponse as unknown as http.ServerResponse, '/api/v1/settings/home-assistant', 'POST', saveContainer);
    expect(saveResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(saveResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));

    const statusContainer = createContainer();
    statusContainer.services.homeAssistantSettingsService.getStatus = jest.fn().mockRejectedValue(new Error('status unavailable'));
    const statusResponse = new MockResponse();
    await routes.handle(createRequest(), statusResponse as unknown as http.ServerResponse, '/api/v1/settings/home-assistant/status', 'GET', statusContainer);
    expect(statusResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(statusResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_CONNECTION_ERROR'));
  });
});