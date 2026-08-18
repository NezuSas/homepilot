import { EventEmitter } from 'events';
import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';

const createAutomationRuleUseCase = jest.fn();
const updateAutomationRuleUseCase = jest.fn();
const enableAutomationRuleUseCase = jest.fn();
const disableAutomationRuleUseCase = jest.fn();
const deleteAutomationRuleUseCase = jest.fn();

jest.mock('../../../packages/devices/application/usecases/automation/CreateAutomationRuleUseCase', () => ({ createAutomationRuleUseCase }));
jest.mock('../../../packages/devices/application/usecases/automation/UpdateAutomationRuleUseCase', () => ({ updateAutomationRuleUseCase }));
jest.mock('../../../packages/devices/application/usecases/automation/EnableAutomationRuleUseCase', () => ({ enableAutomationRuleUseCase }));
jest.mock('../../../packages/devices/application/usecases/automation/DisableAutomationRuleUseCase', () => ({ disableAutomationRuleUseCase }));
jest.mock('../../../packages/devices/application/usecases/automation/DeleteAutomationRuleUseCase', () => ({ deleteAutomationRuleUseCase }));

import { AutomationRoutes } from '../routes/AutomationRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
}

function request(body?: unknown): HomePilotRequest {
  const value = new EventEmitter() as HomePilotRequest;
  value.headers = {};
  value.user = { id: 'owner-1', username: 'Oscar', role: 'admin', displayName: null, avatarDataUri: null };
  value._fastifyParsedBody = JSON.stringify(body ?? {});
  return value;
}

function container(): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: {
      homeRepository: { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }), findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
      roomRepository: { findRoomById: jest.fn() },
      automationRuleRepository: {},
      deviceRepository: {},
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: automation mutation route contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a rule and maps validation failures to a client-safe response', async () => {
    const routes = new AutomationRoutes();
    const success = new MockResponse();
    createAutomationRuleUseCase.mockResolvedValue({ id: 'rule-1', name: 'Night mode' });
    await routes.handle(request({ name: 'Night mode', trigger: { type: 'time' }, action: { type: 'scene', sceneId: 'scene-1' } }), success as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container());
    expect(success.writeHead).toHaveBeenCalledWith(201, expect.any(Object));

    const failure = new MockResponse();
    const error = new Error('Invalid rule');
    Object.defineProperty(error, 'constructor', { value: { name: 'InvalidAutomationRuleError' } });
    createAutomationRuleUseCase.mockRejectedValue(error);
    await routes.handle(request({}), failure as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container());
    expect(failure.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(failure.end).toHaveBeenCalledWith(expect.stringContaining('INVALIDAUTOMATIONRULEERROR'));
  });

  it('updates, enables, disables and deletes rules through their explicit route contracts', async () => {
    const routes = new AutomationRoutes();
    updateAutomationRuleUseCase.mockResolvedValue({ id: 'rule-1', name: 'Updated' });
    enableAutomationRuleUseCase.mockResolvedValue({ id: 'rule-1', enabled: true });
    disableAutomationRuleUseCase.mockResolvedValue({ id: 'rule-1', enabled: false });
    deleteAutomationRuleUseCase.mockResolvedValue(undefined);

    const patch = new MockResponse();
    await routes.handle(request({ name: 'Updated' }), patch as unknown as http.ServerResponse, '/api/v1/automations/rule-1', 'PATCH', container());
    expect(patch.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

    const enable = new MockResponse();
    await routes.handle(request(), enable as unknown as http.ServerResponse, '/api/v1/automations/rule-1/enable', 'PATCH', container());
    expect(enable.end).toHaveBeenCalledWith(expect.stringContaining('"enabled":true'));

    const disable = new MockResponse();
    await routes.handle(request(), disable as unknown as http.ServerResponse, '/api/v1/automations/rule-1/disable', 'PATCH', container());
    expect(disable.end).toHaveBeenCalledWith(expect.stringContaining('"enabled":false'));

    const remove = new MockResponse();
    await routes.handle(request(), remove as unknown as http.ServerResponse, '/api/v1/automations/rule-1', 'DELETE', container());
    expect(remove.writeHead).toHaveBeenCalledWith(204);
    expect(remove.end).toHaveBeenCalled();
  });
});
describe('Feature: automation mutation failure contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  function namedError(name: string, message: string): Error {
    const error = new Error(message);
    Object.defineProperty(error, 'constructor', { value: { name } });
    return error;
  }

  it('maps create and update domain failures without exposing internal route details', async () => {
    const routes = new AutomationRoutes();
    const createResponse = new MockResponse();
    createAutomationRuleUseCase.mockRejectedValue(namedError('DeviceNotFoundError', 'device-9'));

    await routes.handle(request({ name: 'Night', trigger: { type: 'time' }, action: { type: 'scene', sceneId: 'scene-1' } }), createResponse as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container());

    expect(createResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(createResponse.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));

    const updateResponse = new MockResponse();
    updateAutomationRuleUseCase.mockRejectedValue(namedError('AutomationLoopError', 'loop detected'));
    await routes.handle(request({}), updateResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9', 'PATCH', container());

    expect(updateResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(updateResponse.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATIONLOOPERROR'));
  });

  it('maps missing enable, disable, and delete targets to their stable not-found contracts', async () => {
    const routes = new AutomationRoutes();
    enableAutomationRuleUseCase.mockRejectedValue(namedError('AutomationRuleNotFoundError', 'missing'));
    disableAutomationRuleUseCase.mockRejectedValue(namedError('AutomationRuleNotFoundError', 'missing'));
    deleteAutomationRuleUseCase.mockRejectedValue(namedError('AutomationRuleNotFoundError', 'missing'));

    const enableResponse = new MockResponse();
    await routes.handle(request(), enableResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9/enable', 'PATCH', container());
    expect(enableResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(enableResponse.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_ERROR'));

    const disableResponse = new MockResponse();
    await routes.handle(request(), disableResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9/disable', 'PATCH', container());
    expect(disableResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

    const deleteResponse = new MockResponse();
    await routes.handle(request(), deleteResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9', 'DELETE', container());
    expect(deleteResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(deleteResponse.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_DELETE_ERROR'));
  });
});
describe('Feature: automation topology reference validation', () => {
  it('validates home existence, owner membership, and room-home membership used by automation mutations', async () => {
    const routes = new AutomationRoutes();
    const guardedContainer = container() as unknown as {
      repositories: { homeRepository: { findHomeById: jest.Mock; findHomesByUserId: jest.Mock }; roomRepository: { findRoomById: jest.Mock } };
    } & BootstrapContainer;
    const internals = routes as unknown as {
      createTopologyReferencePort(value: BootstrapContainer): {
        validateHomeExists(homeId: string): Promise<void>;
        validateHomeOwnership(homeId: string, userId: string): Promise<void>;
        validateRoomBelongsToHome(roomId: string, homeId: string): Promise<void>;
      };
    };
    const port = internals.createTopologyReferencePort(guardedContainer);

    await expect(port.validateHomeExists('home-1')).resolves.toBeUndefined();
    guardedContainer.repositories.homeRepository.findHomeById.mockResolvedValueOnce(null);
    await expect(port.validateHomeExists('missing')).rejects.toThrow('Home with id missing');

    guardedContainer.repositories.homeRepository.findHomeById.mockResolvedValue({ id: 'home-1' });
    guardedContainer.repositories.homeRepository.findHomesByUserId.mockResolvedValue([{ id: 'other-home' }]);
    await expect(port.validateHomeOwnership('home-1', 'owner-1')).rejects.toThrow('Forbidden access');

    guardedContainer.repositories.roomRepository.findRoomById.mockResolvedValue({ id: 'room-1', homeId: 'other-home' });
    await expect(port.validateRoomBelongsToHome('room-1', 'home-1')).rejects.toThrow('does not belong');
    guardedContainer.repositories.roomRepository.findRoomById.mockResolvedValue(null);
    await expect(port.validateRoomBelongsToHome('missing-room', 'home-1')).rejects.toThrow('Room with id missing-room');
  });
});
describe('Feature: automation mutation authorization and failure isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stops protected update, state change, and deletion routes before their use cases when the role guard rejects access', async () => {
    const routes = new AutomationRoutes();
    const blockedContainer = container();
    (blockedContainer.guards.authGuard.requireRole as jest.Mock).mockReturnValue(false);

    for (const [pathname, body] of [
      ['/api/v1/automations/rule-1', { name: 'Blocked' }],
      ['/api/v1/automations/rule-1/enable', {}],
    ] as const) {
      const response = new MockResponse();
      await routes.handle(request(body), response as unknown as http.ServerResponse, pathname, 'PATCH', blockedContainer);
      expect(response.writeHead).not.toHaveBeenCalled();
    }

    const deleteResponse = new MockResponse();
    await routes.handle(request(), deleteResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-1', 'DELETE', blockedContainer);

    expect(updateAutomationRuleUseCase).not.toHaveBeenCalled();
    expect(enableAutomationRuleUseCase).not.toHaveBeenCalled();
    expect(deleteAutomationRuleUseCase).not.toHaveBeenCalled();
  });

  it('maps a missing update target and an unexpected deletion failure to their public contracts', async () => {
    const routes = new AutomationRoutes();
    const updateError = new Error('rule missing');
    Object.defineProperty(updateError, 'constructor', { value: { name: 'AutomationRuleNotFoundError' } });
    updateAutomationRuleUseCase.mockRejectedValue(updateError);
    const updateResponse = new MockResponse();

    await routes.handle(request({ name: 'Updated' }), updateResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9', 'PATCH', container());

    expect(updateResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(updateResponse.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_NOT_FOUND'));

    deleteAutomationRuleUseCase.mockRejectedValue(new Error('repository unavailable'));
    const deleteResponse = new MockResponse();
    await routes.handle(request(), deleteResponse as unknown as http.ServerResponse, '/api/v1/automations/rule-9', 'DELETE', container());

    expect(deleteResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(deleteResponse.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_DELETE_ERROR'));
  });
});