import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SceneRoutes } from '../routes/SceneRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
}

function createRequest(body?: unknown): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/scenes';
  request.headers = { host: 'localhost' };
  request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: 'Owner', avatarDataUri: null };
  request._fastifyParsedBody = body === undefined ? undefined : JSON.stringify(body);
  return request;
}

function createContainer(isAuthorized = true): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(isAuthorized), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: {
      homeRepository: {
        findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]),
        findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }),
      },
      sceneRepository: {
        findScenesByHomeId: jest.fn().mockResolvedValue([{ id: 'scene-1', homeId: 'home-1' }]),
        saveScene: jest.fn().mockResolvedValue(undefined),
        findSceneById: jest.fn(),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: scene route contract', () => {
  it('Scenario: Given an unauthenticated request When scenes are requested Then no repository is queried', async () => {
    const container = createContainer(false);

    await new SceneRoutes().handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/scenes', 'GET', container);

    expect(container.repositories.homeRepository.findHomesByUserId).not.toHaveBeenCalled();
    expect(container.repositories.sceneRepository.findScenesByHomeId).not.toHaveBeenCalled();
  });

  it('Scenario: Given a signed-in owner When listing scenes Then only that home is queried', async () => {
    const container = createContainer();
    const response = new MockResponse();

    await new SceneRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/scenes', 'GET', container);

    expect(container.repositories.sceneRepository.findScenesByHomeId).toHaveBeenCalledWith('home-1');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('Scenario: Given a malformed scene payload When creating Then persistence is not attempted', async () => {
    const container = createContainer();
    const response = new MockResponse();

    await new SceneRoutes().handle(createRequest({ name: 'Movie time' }), response as unknown as http.ServerResponse, '/api/v1/scenes', 'POST', container);

    expect(container.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('Scenario: Given a valid owner scene When creating Then it is persisted for the selected home', async () => {
    const container = createContainer();
    const response = new MockResponse();

    await new SceneRoutes().handle(
      createRequest({ name: 'Movie time', homeId: 'home-1', actions: [{ deviceId: 'light-1', command: 'turn_off' }] }),
      response as unknown as http.ServerResponse,
      '/api/v1/scenes',
      'POST',
      container,
    );

    expect(container.repositories.sceneRepository.saveScene).toHaveBeenCalledWith(expect.objectContaining({
      homeId: 'home-1',
      name: 'Movie time',
      actions: [{ deviceId: 'light-1', command: 'turn_off' }],
    }));
    expect(response.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });
  it('Scenario: Given an explicitly requested foreign home When listing scenes Then the route denies access', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue({ id: 'home-2' });
    const request = createRequest();
    request.url = '/api/v1/scenes?homeId=home-2';
    const response = new MockResponse();

    await new SceneRoutes().handle(request, response as unknown as http.ServerResponse, '/api/v1/scenes', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('Scenario: Given an existing scene When updating and deleting it Then the route persists then returns no content', async () => {
    const container = createContainer();
    const existing = { id: 'scene-1', homeId: 'home-1', roomId: null, name: 'Old', actions: [{ deviceId: 'light-1', command: 'turn_on' }], createdAt: '', updatedAt: '' };
    (container.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue(existing);
    (container.repositories.sceneRepository as unknown as { deleteScene: jest.Mock }).deleteScene = jest.fn().mockResolvedValue(undefined);
    const updateResponse = new MockResponse();
    const deleteResponse = new MockResponse();

    await new SceneRoutes().handle(createRequest({ name: 'New', executionMode: 'sequential' }), updateResponse as unknown as http.ServerResponse, '/api/v1/scenes/scene-1', 'PATCH', container);
    await new SceneRoutes().handle(createRequest(), deleteResponse as unknown as http.ServerResponse, '/api/v1/scenes/scene-1', 'DELETE', container);

    expect(container.repositories.sceneRepository.saveScene).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', executionMode: 'sequential' }));
    expect((container.repositories.sceneRepository as unknown as { deleteScene: jest.Mock }).deleteScene).toHaveBeenCalledWith('scene-1');
    expect(deleteResponse.writeHead).toHaveBeenCalledWith(204);
  });

  it('Scenario: Given a scene without actions When executing it Then it completes without invoking the executor', async () => {
    const container = createContainer();
    (container.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue({ id: 'scene-1', homeId: 'home-1', name: 'Empty', actions: [] });
    const response = new MockResponse();

    await new SceneRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/scenes/scene-1/execute', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"actions":[]'));
  });
  it('returns DB_ERROR when scenes cannot be listed', async () => {
    const container = createContainer();
    const response = new MockResponse();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockRejectedValue(new Error('database offline'));

    await new SceneRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/scenes', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('returns false for a path outside the scene route contract', async () => {
    const container = createContainer();
    const response = new MockResponse();

    const handled = await new SceneRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/not-scenes', 'GET', container);

    expect(handled).toBe(false);
    expect(container.guards.authGuard.protect).not.toHaveBeenCalled();
  });
});

describe('Feature: scene execution result contracts', () => {
  const scene = { id: 'scene-1', homeId: 'home-1', roomId: null, name: 'Movie', actions: [{ deviceId: 'light-1', command: 'turn_off' }] };
  const makeContainer = (result: { status: 'success' | 'partial'; actions: Array<{ status: 'success' | 'failed' }> }) => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: {
      sceneRepository: { findSceneById: jest.fn().mockResolvedValue(scene) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
    },
    services: { sceneExecutionService: { execute: jest.fn().mockResolvedValue(result) } },
  }) as unknown as BootstrapContainer;
  const request = () => ({ headers: {}, user: { id: 'owner-1', username: 'Oscar', role: 'admin' } }) as unknown as HomePilotRequest;

  it('returns success after executing every scene action and logs the lifecycle', async () => {
    const container = makeContainer({ status: 'success', actions: [{ status: 'success' }] });
    const response = new MockResponse();
    await new SceneRoutes().handle(request(), response as unknown as http.ServerResponse, '/api/v1/scenes/scene-1/execute', 'POST', container);
    expect(container.services.sceneExecutionService.execute).toHaveBeenCalledWith(scene);
    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledTimes(2);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('returns multi-status when a scene action fails but another succeeds', async () => {
    const partialScene = { ...scene, actions: [{ deviceId: 'light-1', command: 'turn_off' }, { deviceId: 'light-2', command: 'turn_on' }] };
    const container = makeContainer({ status: 'partial', actions: [{ status: 'success' }, { status: 'failed' }] }) as unknown as { repositories: { sceneRepository: { findSceneById: jest.Mock } } } & BootstrapContainer;
    container.repositories.sceneRepository.findSceneById.mockResolvedValue(partialScene);
    const response = new MockResponse();
    await new SceneRoutes().handle(request(), response as unknown as http.ServerResponse, '/api/v1/scenes/scene-1/execute', 'POST', container);
    expect(response.writeHead).toHaveBeenCalledWith(207, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"partial"'));
  });
});
describe('Feature: scene ownership and failed execution contracts', () => {
  it('rejects creation for missing and foreign homes before saving a scene', async () => {
    const routes = new SceneRoutes();
    const missing = createContainer();
    (missing.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue(null);
    const missingResponse = new MockResponse();
    await routes.handle(createRequest({ name: 'Movie', homeId: 'missing', actions: [{ deviceId: 'light-1', command: 'turn_off' }] }), missingResponse as unknown as http.ServerResponse, '/api/v1/scenes', 'POST', missing);
    expect(missing.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(missingResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(missingResponse.end).toHaveBeenCalledWith(expect.stringContaining('HOME_NOT_FOUND'));

    const foreign = createContainer();
    (foreign.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue({ id: 'home-2' });
    const foreignResponse = new MockResponse();
    await routes.handle(createRequest({ name: 'Movie', homeId: 'home-2', actions: [{ deviceId: 'light-1', command: 'turn_off' }] }), foreignResponse as unknown as http.ServerResponse, '/api/v1/scenes', 'POST', foreign);
    expect(foreign.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(foreignResponse.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('returns a failed result with HTTP 500 when every scene action fails', async () => {
    const scene = { id: 'scene-1', homeId: 'home-1', roomId: null, name: 'Movie', actions: [{ deviceId: 'light-1', command: 'turn_off' }] };
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      repositories: {
        sceneRepository: { findSceneById: jest.fn().mockResolvedValue(scene) },
        activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
      },
      services: { sceneExecutionService: { execute: jest.fn().mockResolvedValue({ status: 'failed', actions: [{ status: 'failed' }] }) } },
    } as unknown as BootstrapContainer;
    const response = new MockResponse();
    const request = { headers: {}, user: { id: 'owner-1', username: 'Oscar', role: 'admin' } } as unknown as HomePilotRequest;

    await new SceneRoutes().handle(request, response as unknown as http.ServerResponse, '/api/v1/scenes/scene-1/execute', 'POST', container);

    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledTimes(2);
    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"failed"'));
  });
});
describe('Feature: scene route resilience contracts', () => {
  it('contains persistence failures for scene mutations and never reports a false success', async () => {
    const routes = new SceneRoutes();
    const payload = { name: 'Movie', homeId: 'home-1', actions: [{ deviceId: 'light-1', command: 'turn_off' }] };

    const createFailure = createContainer();
    (createFailure.repositories.sceneRepository.saveScene as jest.Mock).mockRejectedValue(new Error('write unavailable'));
    const createResponse = new MockResponse();
    await routes.handle(createRequest(payload), createResponse as unknown as http.ServerResponse, '/api/v1/scenes', 'POST', createFailure);
    expect(createResponse.end).toHaveBeenCalledWith(expect.stringContaining('SCENE_CREATE_ERROR'));

    const updateFailure = createContainer();
    (updateFailure.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue({ id: 'scene-1', homeId: 'home-1', name: 'Movie', roomId: null, actions: [] });
    (updateFailure.repositories.sceneRepository.saveScene as jest.Mock).mockRejectedValue(new Error('write unavailable'));
    const updateResponse = new MockResponse();
    await routes.handle(createRequest({ name: 'Updated' }), updateResponse as unknown as http.ServerResponse, '/api/v1/scenes/scene-1', 'PATCH', updateFailure);
    expect(updateResponse.end).toHaveBeenCalledWith(expect.stringContaining('SCENE_UPDATE_ERROR'));

    const deleteFailure = createContainer() as unknown as { repositories: { sceneRepository: { deleteScene: jest.Mock } } } & BootstrapContainer;
    deleteFailure.repositories.sceneRepository.deleteScene = jest.fn().mockRejectedValue(new Error('write unavailable'));
    const deleteResponse = new MockResponse();
    await routes.handle(createRequest(), deleteResponse as unknown as http.ServerResponse, '/api/v1/scenes/scene-1', 'DELETE', deleteFailure);
    expect(deleteResponse.end).toHaveBeenCalledWith(expect.stringContaining('SCENE_DELETE_ERROR'));
  });

  it('denies administrative mutations and maps execution failures without leaking an unhandled exception', async () => {
    const routes = new SceneRoutes();
    const denied = createContainer();
    (denied.guards.authGuard.requireRole as jest.Mock).mockReturnValue(false);
    const deniedResponse = new MockResponse();
    await routes.handle(createRequest({ name: 'Blocked', homeId: 'home-1', actions: [] }), deniedResponse as unknown as http.ServerResponse, '/api/v1/scenes', 'POST', denied);
    expect(denied.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();

    const executionFailure = createContainer() as unknown as BootstrapContainer;
    (executionFailure.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue({ id: 'scene-1', homeId: 'home-1', name: 'Movie', actions: [{ deviceId: 'light-1', command: 'turn_off' }] });
    (executionFailure.repositories as unknown as { activityLogRepository: { saveActivity: jest.Mock } }).activityLogRepository = { saveActivity: jest.fn().mockResolvedValue(undefined) };
    (executionFailure as unknown as { services: { sceneExecutionService: { execute: jest.Mock } } }).services = { sceneExecutionService: { execute: jest.fn().mockRejectedValue(new Error('dispatcher unavailable')) } };
    const executionResponse = new MockResponse();
    await routes.handle(createRequest(), executionResponse as unknown as http.ServerResponse, '/api/v1/scenes/scene-1/execute', 'POST', executionFailure);
    expect(executionResponse.end).toHaveBeenCalledWith(expect.stringContaining('SCENE_EXECUTE_ERROR'));
  });
});
describe('Feature: scene route boundary contracts', () => {
  it('returns a stable not-found response before attempting to update an unknown scene', async () => {
    const container = createContainer();
    (container.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue(null);
    const response = new MockResponse();

    await new SceneRoutes().handle(
      createRequest({ name: 'Updated scene' }),
      response as unknown as http.ServerResponse,
      '/api/v1/scenes/missing-scene',
      'PATCH',
      container,
    );

    expect(container.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
  });

  it('returns a stable not-found response before executing an unknown scene', async () => {
    const container = createContainer();
    (container.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue(null);
    const response = new MockResponse();

    await new SceneRoutes().handle(
      createRequest(),
      response as unknown as http.ServerResponse,
      '/api/v1/scenes/missing-scene/execute',
      'POST',
      container,
    );

    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
  });

  it('keeps a completed execution successful when only the trailing audit record fails', async () => {
    const scene = {
      id: 'scene-1', homeId: 'home-1', roomId: null, name: 'Movie',
      actions: [{ deviceId: 'light-1', command: 'turn_off' }],
    };
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      repositories: {
        sceneRepository: { findSceneById: jest.fn().mockResolvedValue(scene) },
        activityLogRepository: {
          saveActivity: jest.fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('audit storage unavailable')),
        },
      },
      services: { sceneExecutionService: { execute: jest.fn().mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] }) } },
    } as unknown as BootstrapContainer;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = new MockResponse();

    try {
      await new SceneRoutes().handle(
        createRequest(),
        response as unknown as http.ServerResponse,
        '/api/v1/scenes/scene-1/execute',
        'POST',
        container,
      );

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"success"'));
      expect(errorSpy).toHaveBeenCalledWith('[SceneRoutes] Failed to log scene execution:', 'audit storage unavailable');
    } finally {
      errorSpy.mockRestore();
    }
  });
});