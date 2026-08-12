import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SystemVariableRoutes } from '../routes/SystemVariableRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/system-variables';
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = JSON.stringify({ scope: 'global', name: 'night_mode', value: 'true', valueType: 'boolean' });
  return request;
}

function createContainer(isAdmin: boolean): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(true),
        requireRole: jest.fn().mockReturnValue(isAdmin),
      },
    },
    services: {
      systemVariableService: {
        set: jest.fn().mockResolvedValue({ id: 'variable-1', scope: 'global', homeId: null, name: 'night_mode', value: 'true', valueType: 'boolean' }),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: system variable administration', () => {
  it('Scenario: Given a non-admin user When writing a system variable Then the route denies the operation without mutating the service', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(false);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system-variables', 'POST', container);

    expect(container.guards.authGuard.requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    expect(container.services.systemVariableService.set).not.toHaveBeenCalled();
  });

  it('Scenario: Given an admin user When writing a typed system variable Then the route delegates the validated payload to the service', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system-variables', 'POST', container);

    expect(container.services.systemVariableService.set).toHaveBeenCalledWith({
      scope: 'global', homeId: null, name: 'night_mode', value: 'true', valueType: 'boolean', description: null, ttlSeconds: null,
    });
  });
});