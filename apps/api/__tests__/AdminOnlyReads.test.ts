import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AssistantRoutes } from '../routes/AssistantRoutes';
import { DeviceRoutes } from '../routes/DeviceRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
  public setHeader(): this { return this; }
}

function createRequest(url: string, body: unknown = {}): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'user-1', username: 'ana', role: 'parent', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = JSON.stringify(body);
  return request;
}

function createContainer(isAdmin: boolean) {
  const assistantService = {
    listOpen: jest.fn().mockResolvedValue([]),
    getSummary: jest.fn().mockResolvedValue({ totalOpen: 0 }),
    scan: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(undefined),
    resolve: jest.fn().mockResolvedValue(undefined),
  };
  const deviceRepository = { findDeviceById: jest.fn() };
  const activityLogRepository = { findRecentByDeviceId: jest.fn() };
  const container = {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(isAdmin) } },
    services: { assistantService, assistantActionService: { handleAction: jest.fn() } },
    repositories: {
      homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
      deviceRepository,
      activityLogRepository,
    },
    adapters: { topologyReferencePort: { validateHomeOwnership: jest.fn() } },
  } as unknown as BootstrapContainer;
  return { container, assistantService, deviceRepository, activityLogRepository };
}

describe('Feature: system information is for the administrator, the rest of the household only uses it', () => {
  const assistantRoutes: ReadonlyArray<readonly [string, string]> = [
    ['GET', '/api/v1/assistant/findings'],
    ['GET', '/api/v1/assistant/summary'],
    ['POST', '/api/v1/assistant/scan'],
    ['POST', '/api/v1/assistant/findings/f1/dismiss'],
    ['POST', '/api/v1/assistant/findings/f1/resolve'],
    ['POST', '/api/v1/assistant/actions'],
  ];

  it.each(assistantRoutes)('Scenario: Given a non-administrator When %s %s is called Then the assistant insight service is not reached', async (method, path) => {
    const { container, assistantService } = createContainer(false);
    const response = new MockResponse();

    await new AssistantRoutes().handle(createRequest(path, { findingId: 'f1', actionType: 'x' }), response as unknown as http.ServerResponse, path, method, container);

    expect(container.guards.authGuard.requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    Object.values(assistantService).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    expect(container.services.assistantActionService.handleAction).not.toHaveBeenCalled();
  });

  it.each(assistantRoutes.slice(0, 5))('Scenario: Given an administrator When %s %s is called Then the request is served', async (method, path) => {
    const { container } = createContainer(true);
    const response = new MockResponse();

    await new AssistantRoutes().handle(createRequest(path), response as unknown as http.ServerResponse, path, method, container);

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it.each([
    '/api/v1/devices/light-1/history',
    '/api/v1/devices/light-1/activity-logs',
  ])('Scenario: Given a non-administrator When %s is read Then no device or log is looked up', async (path) => {
    const { container, deviceRepository, activityLogRepository } = createContainer(false);
    const response = new MockResponse();

    await new DeviceRoutes().handle(createRequest(path), response as unknown as http.ServerResponse, path, 'GET', container);

    expect(container.guards.authGuard.requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    expect(deviceRepository.findDeviceById).not.toHaveBeenCalled();
    expect(activityLogRepository.findRecentByDeviceId).not.toHaveBeenCalled();
  });
});
