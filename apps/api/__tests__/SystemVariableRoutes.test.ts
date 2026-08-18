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

function createRequest(body: unknown = { scope: 'global', name: 'night_mode', value: 'true', valueType: 'boolean' }, url = '/api/v1/system-variables'): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = JSON.stringify(body);
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
        list: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(true),
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
  it('Scenario: Given scoped list filters When listing variables Then the service receives the normalized filter', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);
    const response = new MockResponse();

    await routes.handle(
      createRequest(undefined, '/api/v1/system-variables?scope=home&homeId=home-1'),
      response as unknown as http.ServerResponse,
      '/api/v1/system-variables',
      'GET',
      container,
    );

    expect(container.services.systemVariableService.list).toHaveBeenCalledWith({ scope: 'home', homeId: 'home-1' });
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('Scenario: Given a missing variable When reading it Then the route reports not found', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/system-variables/missing', 'GET', container);

    expect(container.services.systemVariableService.getById).toHaveBeenCalledWith('missing');
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('Scenario: Given an unsupported value type When writing a variable Then validation prevents the mutation', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);
    const response = new MockResponse();

    await routes.handle(
      createRequest({ scope: 'global', name: 'night_mode', value: 'true', valueType: 'date' }),
      response as unknown as http.ServerResponse,
      '/api/v1/system-variables',
      'POST',
      container,
    );

    expect(container.services.systemVariableService.set).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it('Scenario: Given an admin user When deleting a variable Then it reports success', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/system-variables/variable-1', 'DELETE', container);

    expect(container.services.systemVariableService.delete).toHaveBeenCalledWith('variable-1');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
  });
  it('returns stable contracts for read, validation, deletion, and route failures', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);

    const blocked = new MockResponse();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValueOnce(false);
    await routes.handle(createRequest(), blocked as unknown as http.ServerResponse, '/api/v1/system-variables', 'GET', container);
    expect(container.services.systemVariableService.list).not.toHaveBeenCalled();

    const invalidScope = new MockResponse();
    await routes.handle(createRequest({ scope: 'tenant', name: 'night_mode', value: 'true', valueType: 'boolean' }), invalidScope as unknown as http.ServerResponse, '/api/v1/system-variables', 'POST', container);
    expect(invalidScope.writeHead).toHaveBeenCalledWith(400, expect.any(Object));

    const missingValue = new MockResponse();
    await routes.handle(createRequest({ scope: 'global', name: 'night_mode', valueType: 'boolean' }), missingValue as unknown as http.ServerResponse, '/api/v1/system-variables', 'POST', container);
    expect(missingValue.writeHead).toHaveBeenCalledWith(400, expect.any(Object));

    (container.services.systemVariableService.getById as jest.Mock).mockResolvedValueOnce({ id: 'variable-1', name: 'night_mode' });
    const present = new MockResponse();
    await routes.handle(createRequest(), present as unknown as http.ServerResponse, '/api/v1/system-variables/variable-1', 'GET', container);
    expect(present.end).toHaveBeenCalledWith(expect.stringContaining('night_mode'));

    (container.services.systemVariableService.delete as jest.Mock).mockResolvedValueOnce(false);
    const absent = new MockResponse();
    await routes.handle(createRequest(), absent as unknown as http.ServerResponse, '/api/v1/system-variables/missing', 'DELETE', container);
    expect(absent.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

    const unmatched = new MockResponse();
    await routes.handle(createRequest(), unmatched as unknown as http.ServerResponse, '/api/v1/system-variables/unknown/path', 'PATCH', container);
    expect(unmatched.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
});

describe('Feature: system variable persistence resilience', () => {
  it('Scenario: Given a persistence failure while saving a variable When an admin submits valid input Then the route returns the stable internal error contract', async () => {
    const routes = new SystemVariableRoutes();
    const container = createContainer(true);
    (container.services.systemVariableService.set as jest.Mock).mockRejectedValue(new Error('variable storage offline'));
    const response = new MockResponse();

    await routes.handle(
      createRequest({ scope: 'home', homeId: 'home-1', name: 'night_mode', value: 'true', valueType: 'boolean', description: 'Night policy', ttlSeconds: 90 }),
      response as unknown as http.ServerResponse,
      '/api/v1/system-variables',
      'POST',
      container,
    );

    expect(container.services.systemVariableService.set).toHaveBeenCalledWith({
      scope: 'home', homeId: 'home-1', name: 'night_mode', value: 'true', valueType: 'boolean', description: 'Night policy', ttlSeconds: 90,
    });
    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('variable storage offline'));
  });
});