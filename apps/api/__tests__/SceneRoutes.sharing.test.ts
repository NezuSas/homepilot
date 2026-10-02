import { EventEmitter } from 'events';
import type { ServerResponse } from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SceneRoutes } from '../routes/SceneRoutes';
import { AutomationRoutes } from '../routes/AutomationRoutes';

class Response extends EventEmitter {
  writeHead = jest.fn().mockReturnThis();
  end = jest.fn().mockReturnThis();
}
const request = (userId: string, body?: unknown) => {
  const req = new EventEmitter() as HomePilotRequest;
  req.headers = { host: 'localhost' };
  req.url = '/api/v1/scenes';
  req.user = { id: userId, username: userId, role: 'admin', displayName: userId, avatarDataUri: null };
  req._fastifyParsedBody = JSON.stringify(body ?? {});
  return req;
};

describe('Feature: Explicit scene and automation sharing', () => {
  function setup() {
    const scene = { id: 'scene', homeId: 'home', userId: 'owner', sharedUserIds: ['recipient'], name: 'Salir', roomId: null, actions: [{ deviceId: 'light', command: 'turn_off' }], createdAt: '', updatedAt: '' };
    const automation = { id: 'automation', homeId: 'home', userId: 'owner', sharedUserIds: ['recipient'], name: 'Salir a las 19', enabled: true, trigger: { type: 'time', timeLocal: '19:00', timezone: 'America/Guayaquil', timeUTC: '00:00' }, action: { type: 'execute_scene', sceneId: 'scene' } };
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
      repositories: {
        homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home' }]), findHomeById: jest.fn().mockResolvedValue({ id: 'home' }) },
        userRepository: { findById: jest.fn().mockResolvedValue({ id: 'recipient', isActive: true }), findAll: jest.fn().mockResolvedValue([{ id: 'owner', username: 'owner', isActive: true }, { id: 'recipient', username: 'recipient', displayName: 'Receptor', isActive: true, passwordHash: 'not-public' }]) },
        sceneRepository: { findSceneById: jest.fn().mockResolvedValue(scene), findScenesByHomeId: jest.fn().mockResolvedValue([scene]), saveScene: jest.fn().mockResolvedValue(undefined), deleteScene: jest.fn() },
        automationRuleRepository: { findById: jest.fn().mockResolvedValue(automation), findByHomeId: jest.fn().mockResolvedValue([automation]), save: jest.fn(), delete: jest.fn() },
        assistantMemoryRepository: { findByKey: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
        activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
      },
      services: { sceneExecutionService: { execute: jest.fn().mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] }) } },
      engine: { runRuleNow: jest.fn().mockResolvedValue({ success: true }) },
    } as unknown as BootstrapContainer;
    return { scene, automation, container };
  }
  async function call(route: SceneRoutes | AutomationRoutes, container: BootstrapContainer, user: string, path: string, method: string, body?: unknown) {
    const res = new Response();
    await route.handle(request(user, body), res as unknown as ServerResponse, path, method, container);
    return res;
  }
  it('allows recipients to list, execute and favorite both types, never strangers', async () => {
    const { container } = setup();
    for (const [route, collection, id, execute, key] of [[new SceneRoutes(), 'scenes', 'scene', 'execute', 'sceneIds'], [new AutomationRoutes(), 'automations', 'automation', 'run', 'automationIds']] as const) {
      const listed = await call(route, container, 'recipient', `/api/v1/${collection}`, 'GET');
      expect(JSON.parse(listed.end.mock.calls[0][0])).toHaveLength(1);
      expect((await call(route, container, 'recipient', `/api/v1/${collection}/${id}/${execute}`, 'POST')).writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect((await call(route, container, 'recipient', `/api/v1/${collection}/favorites`, 'PUT', { [key]: [id] })).writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect((await call(route, container, 'stranger', `/api/v1/${collection}/${id}/${execute}`, 'POST')).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    }
  });
  it('denies every administrative mutation for a recipient, including enable/disable', async () => {
    const { container } = setup();
    for (const [route, path] of [[new SceneRoutes(), '/api/v1/scenes/scene'], [new AutomationRoutes(), '/api/v1/automations/automation']] as const) {
      for (const method of ['PATCH', 'DELETE']) expect((await call(route, container, 'recipient', path, method, { name: 'Changed', sharedUserIds: ['stranger'] })).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    }
    for (const action of ['enable', 'disable']) expect((await call(new AutomationRoutes(), container, 'recipient', `/api/v1/automations/automation/${action}`, 'PATCH')).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(container.repositories.sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(container.repositories.automationRuleRepository.save).not.toHaveBeenCalled();
    expect(container.repositories.sceneRepository.deleteScene).not.toHaveBeenCalled();
    expect(container.repositories.automationRuleRepository.delete).not.toHaveBeenCalled();
  });
  it('revoking sharing removes execution and favorite access without changing the owner', async () => {
    const { scene, automation, container } = setup();
    scene.sharedUserIds = [];
    automation.sharedUserIds = [];
    expect((await call(new SceneRoutes(), container, 'recipient', '/api/v1/scenes/scene/execute', 'POST')).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect((await call(new AutomationRoutes(), container, 'recipient', '/api/v1/automations/automation/run', 'POST')).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect((await call(new SceneRoutes(), container, 'recipient', '/api/v1/scenes/favorites', 'PUT', { sceneIds: ['scene'] })).writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(scene.userId).toBe('owner');
  });
  it('sanitizes the sharing directory and refuses inactive recipients', async () => {
    const { container } = setup();
    const directory = await call(new SceneRoutes(), container, 'owner', '/api/v1/scenes/share-users', 'GET');
    expect(JSON.parse(directory.end.mock.calls[0][0])).toEqual([{ id: 'recipient', name: 'Receptor' }]);
    (container.repositories.userRepository.findById as jest.Mock).mockResolvedValue({ isActive: false });
    expect((await call(new SceneRoutes(), container, 'owner', '/api/v1/scenes/scene', 'PATCH', { sharedUserIds: ['inactive'] })).writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });
  it('does not let explicit sharing bypass home membership or expose historical creatorless scenes', async () => {
    const { scene, container } = setup();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);
    expect((await call(new SceneRoutes(), container, 'recipient', '/api/v1/scenes/scene/execute', 'POST')).writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect((await call(new AutomationRoutes(), container, 'recipient', '/api/v1/automations/automation/run', 'POST')).writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    scene.userId = '';
    expect((await call(new SceneRoutes(), container, 'recipient', '/api/v1/scenes/scene/execute', 'POST')).writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(container.services.sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(container.engine!.runRuleNow).not.toHaveBeenCalled();
  });
});
