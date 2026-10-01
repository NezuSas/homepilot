import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AutomationRoutes } from '../routes/AutomationRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
}

function createRequest(role: 'admin' | 'child' = 'admin'): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/automations';
  request.headers = { host: 'localhost' };
  request.user = { id: 'owner-1', username: 'owner', role, displayName: 'Owner', avatarDataUri: null };
  return request;
}

function createContainer(isAuthorized = true): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(isAuthorized),
        requireRole: jest.fn().mockReturnValue(true),
      },
    },
    repositories: {
      homeRepository: {
        findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]),
        findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }),
      },
      automationRuleRepository: {
        findByHomeId: jest.fn().mockResolvedValue([{ id: 'automation-1', homeId: 'home-1', userId: 'owner-1' }]),
        findById: jest.fn().mockResolvedValue({ id: 'automation-1', homeId: 'home-1', userId: 'owner-1' }),
      },
      sceneRepository: { findSceneById: jest.fn().mockResolvedValue(null) },
      assistantMemoryRepository: {
        findByKey: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      roomRepository: { findRoomById: jest.fn() },
    },
    engine: {
      runRuleNow: jest.fn().mockResolvedValue({ success: true }),
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: automation route contract', () => {
  it('keeps automations private between users of the same home', async () => {
    const container = createContainer();
    (container.repositories.automationRuleRepository.findByHomeId as jest.Mock).mockResolvedValue([
      { id: 'mine', homeId: 'home-1', userId: 'owner-1' },
      { id: 'theirs', homeId: 'home-1', userId: 'owner-2' },
    ]);
    const listed = new MockResponse();
    await new AutomationRoutes().handle(createRequest(), listed as unknown as http.ServerResponse, '/api/v1/automations', 'GET', container);
    expect(JSON.parse(listed.end.mock.calls[0][0]).map((rule: { id: string }) => rule.id)).toEqual(['mine']);

    (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue({ id: 'theirs', homeId: 'home-1', userId: 'owner-2' });
    const favoriteRequest = createRequest();
    favoriteRequest._fastifyParsedBody = JSON.stringify({ automationIds: ['theirs'] });
    const favorite = new MockResponse();
    await new AutomationRoutes().handle(favoriteRequest, favorite as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'PUT', container);
    expect(favorite.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    const run = new MockResponse();
    await new AutomationRoutes().handle(createRequest(), run as unknown as http.ServerResponse, '/api/v1/automations/theirs/run', 'POST', container);
    expect(run.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(container.engine?.runRuleNow).not.toHaveBeenCalled();
  });

  it('rejects a scene owned by another user as an automation action', async () => {
    const container = createContainer();
    (container.repositories.sceneRepository.findSceneById as jest.Mock).mockResolvedValue({ id: 'foreign-scene', homeId: 'home-1', userId: 'owner-2' });
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({
      name: 'Foreign scene', trigger: { type: 'time', timeLocal: '12:00', timezone: 'UTC', timeUTC: '12:00' },
      action: { type: 'execute_scene', sceneId: 'foreign-scene' },
    });
    const response = new MockResponse();
    await new AutomationRoutes().handle(request, response as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container);
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('SCENE_NOT_FOUND'));
  });

  it.each([
    ['PATCH', '/api/v1/automations/theirs', { name: 'Changed' }],
    ['PATCH', '/api/v1/automations/theirs/enable', {}],
    ['PATCH', '/api/v1/automations/theirs/disable', {}],
    ['DELETE', '/api/v1/automations/theirs', {}],
  ])('denies %s %s for another user’s automation', async (method, path, body) => {
    const container = createContainer();
    (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue({ id: 'theirs', homeId: 'home-1', userId: 'owner-2' });
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify(body);
    const response = new MockResponse();
    await new AutomationRoutes().handle(request, response as unknown as http.ServerResponse, path, method, container);
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
  it('stores automation favorites under their own user-scoped key and rejects inaccessible rules', async () => {
    const container = createContainer();
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ automationIds: ['automation-1'] });
    const saved = new MockResponse();
    await new AutomationRoutes().handle(request, saved as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'PUT', container);
    expect(saved.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(container.repositories.assistantMemoryRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'owner-1', key: 'pref:automation-favorites', value: '["automation-1"]', expiresAt: null,
    }));

    (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue({ id: 'foreign', homeId: 'other-home' });
    request._fastifyParsedBody = JSON.stringify({ automationIds: ['foreign'] });
    const denied = new MockResponse();
    await new AutomationRoutes().handle(request, denied as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'PUT', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.repositories.assistantMemoryRepository.upsert).toHaveBeenCalledTimes(1);
  });

  it('filters deleted and inaccessible automation favorites and isolates another user', async () => {
    const container = createContainer();
    (container.repositories.assistantMemoryRepository.findByKey as jest.Mock).mockResolvedValue({ value: '["automation-1","deleted","foreign"]' });
    (container.repositories.automationRuleRepository.findById as jest.Mock).mockImplementation(async (id: string) =>
      id === 'automation-1' ? { id, homeId: 'home-1', userId: 'owner-1' } : id === 'foreign' ? { id, homeId: 'other-home' } : null);
    const response = new MockResponse();
    await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'GET', container);
    expect(JSON.parse(response.end.mock.calls[0][0])).toEqual({ automationIds: ['automation-1'], initialized: true });

    const gustavo = createRequest();
    gustavo.user = { ...gustavo.user!, id: 'gustavo' };
    (container.repositories.assistantMemoryRepository.findByKey as jest.Mock).mockResolvedValueOnce(null);
    const otherResponse = new MockResponse();
    await new AutomationRoutes().handle(gustavo, otherResponse as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'GET', container);
    expect(container.repositories.assistantMemoryRepository.findByKey).toHaveBeenCalledWith('gustavo', 'pref:automation-favorites');
    expect(JSON.parse(otherResponse.end.mock.calls[0][0])).toEqual({ automationIds: [], initialized: false });
  });

  it('rejects malformed favorites without modifying persistent preferences', async () => {
    const container = createContainer();
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ automationIds: ['automation-1', 'automation-1'] });
    const response = new MockResponse();
    await new AutomationRoutes().handle(request, response as unknown as http.ServerResponse, '/api/v1/automations/favorites', 'PUT', container);
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(container.repositories.assistantMemoryRepository.upsert).not.toHaveBeenCalled();
  });

  it('Scenario: Given an unauthenticated request When automations are listed Then no data is queried', async () => {
    const container = createContainer(false);

    await new AutomationRoutes().handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/automations', 'GET', container);

    expect(container.repositories.homeRepository.findHomesByUserId).not.toHaveBeenCalled();
  });

  it('Scenario: Given an owner without a home When automations are listed Then an empty collection is returned', async () => {
    const container = createContainer();
    const response = new MockResponse();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);

    await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations', 'GET', container);

    expect(container.repositories.automationRuleRepository.findByHomeId).not.toHaveBeenCalled();
    expect(response.end).toHaveBeenCalledWith('[]');
  });

  it('Scenario: Given an owner home When automations are listed Then its rules are returned', async () => {
    const container = createContainer();
    const response = new MockResponse();

    await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations', 'GET', container);

    expect(container.repositories.automationRuleRepository.findByHomeId).toHaveBeenCalledWith('home-1');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('Scenario: Given a non-admin user When an automation is created Then the route stops before persistence', async () => {
    const container = createContainer();
    const response = new MockResponse();
    (container.guards.authGuard.requireRole as jest.Mock).mockReturnValue(false);

    await new AutomationRoutes().handle(createRequest('child'), response as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container);

    expect(container.guards.authGuard.requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    expect(container.repositories.homeRepository.findHomesByUserId).not.toHaveBeenCalled();
  });
  it('Scenario: Given an administrator without a home When creating an automation Then it returns HOME_NOT_FOUND', async () => {
    const container = createContainer();
    const response = new MockResponse();
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ name: 'At night', trigger: { type: 'time', time: '22:00' }, action: { type: 'device_command', deviceId: 'device-1', command: 'turn_off' } });
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);

    await new AutomationRoutes().handle(request, response as unknown as http.ServerResponse, '/api/v1/automations', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HOME_NOT_FOUND'));
  });
  it('returns DB_ERROR when automation listing fails', async () => {
    const container = createContainer();
    const response = new MockResponse();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockRejectedValue(new Error('database offline'));

    await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('returns false for a path outside the automation route contract', async () => {
    const container = createContainer();
    const response = new MockResponse();

    const handled = await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/not-automations', 'GET', container);

    expect(handled).toBe(false);
    expect(container.guards.authGuard.protect).not.toHaveBeenCalled();
  });

  describe('Scenario: manual "run now" (dashboard routine action cards)', () => {
    it('runs the rule immediately for its owner and returns a correlation id', async () => {
      const container = createContainer();
      const response = new MockResponse();

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/automation-1/run', 'POST', container);

      expect(container.engine!.runRuleNow).toHaveBeenCalledWith('automation-1', expect.any(String));
      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
    });

    it('returns AUTOMATION_NOT_FOUND for an unknown rule id', async () => {
      const container = createContainer();
      const response = new MockResponse();
      (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue(null);

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/missing/run', 'POST', container);

      expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_NOT_FOUND'));
      expect(container.engine!.runRuleNow).not.toHaveBeenCalled();
    });

    it('rejects a rule that does not belong to the requesting user\'s home', async () => {
      const container = createContainer();
      const response = new MockResponse();
      (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue({ id: 'automation-1', homeId: 'other-home', userId: 'owner-1' });
      (container.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue({ id: 'other-home' });

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/automation-1/run', 'POST', container);

      expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
      expect(container.engine!.runRuleNow).not.toHaveBeenCalled();
    });

    it('returns AUTOMATION_RUN_FAILED when the engine reports a failure', async () => {
      const container = createContainer();
      const response = new MockResponse();
      (container.engine!.runRuleNow as jest.Mock).mockResolvedValue({ success: false, error: 'device offline' });

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/automation-1/run', 'POST', container);

      expect(response.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_RUN_FAILED'));
    });

    it('returns AUTOMATION_ENGINE_UNAVAILABLE when the engine is not wired', async () => {
      const container = createContainer();
      delete (container as { engine?: unknown }).engine;
      const response = new MockResponse();

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/automation-1/run', 'POST', container);

      expect(response.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('AUTOMATION_ENGINE_UNAVAILABLE'));
    });

    it('requires authentication before running a rule', async () => {
      const container = createContainer(false);
      const response = new MockResponse();

      await new AutomationRoutes().handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/automations/automation-1/run', 'POST', container);

      expect(container.repositories.automationRuleRepository.findById).not.toHaveBeenCalled();
    });
  });
});
