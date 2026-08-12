import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SystemRoutes } from '../routes/SystemRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/system/diagnostics';
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  return request;
}

function createContainer(isAuthenticated: boolean): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(isAuthenticated),
      },
    },
    services: {
      diagnosticsService: {
        getSnapshot: jest.fn().mockResolvedValue({ overallStatus: 'healthy', issues: [] }),
        getRecentEvents: jest.fn().mockResolvedValue([{ eventType: 'AUTOMATION_EXECUTED' }]),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: system diagnostics API', () => {
  it('Scenario: Given an unauthenticated request When diagnostics is requested Then the service is not exposed', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(false);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics', 'GET', container);

    expect(container.guards.authGuard.protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(container.services.diagnosticsService.getSnapshot).not.toHaveBeenCalled();
  });

  it('Scenario: Given an authenticated request When the snapshot endpoint is requested Then it delegates to DiagnosticsService', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(true);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics', 'GET', container);

    expect(container.services.diagnosticsService.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given an authenticated request When the events endpoint is requested Then it limits the diagnostic timeline to fifty records', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(true);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics/events', 'GET', container);

    expect(container.services.diagnosticsService.getRecentEvents).toHaveBeenCalledWith(50);
  });
});