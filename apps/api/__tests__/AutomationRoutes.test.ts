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
        findByHomeId: jest.fn().mockResolvedValue([{ id: 'automation-1', homeId: 'home-1' }]),
        findById: jest.fn().mockResolvedValue({ id: 'automation-1', homeId: 'home-1' }),
      },
      roomRepository: { findRoomById: jest.fn() },
    },
    engine: {
      runRuleNow: jest.fn().mockResolvedValue({ success: true }),
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: automation route contract', () => {
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
      (container.repositories.automationRuleRepository.findById as jest.Mock).mockResolvedValue({ id: 'automation-1', homeId: 'other-home' });
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
