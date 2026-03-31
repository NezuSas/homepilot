import { AutomationController } from '../../api/controllers/AutomationController';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { AutomationRule } from '../../domain/automation/types';
import { ForbiddenOwnershipError, AutomationRuleNotFoundError } from '../../application/errors';

describe('Automation API: AutomationController', () => {
  let controller: AutomationController;
  let ruleRepo: InMemoryAutomationRuleRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let topologyMock: jest.Mocked<TopologyReferencePort>;

  const idGen = { generate: () => 'rule-123' };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    deviceRepo = new InMemoryDeviceRepository();

    topologyMock = {
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    controller = new AutomationController(ruleRepo, deviceRepo, topologyMock, idGen);
  });

  function bodyAs<T>(res: HttpResponse): T {
    return res.body as T;
  }

  const setupDevices = async () => {
    await deviceRepo.saveDevice({
      id: 'd1', homeId: 'home-1', roomId: 'r1', externalId: 'e1',
      name: 'S', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'd2', homeId: 'home-1', roomId: 'r1', externalId: 'e2',
      name: 'L', type: 'light', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });
  };

  const saveBaseRule = () => ruleRepo.save({
    id: 'r1', homeId: 'home-1', userId: 'u1', name: 'Rule 1', enabled: true,
    trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: 'v' },
    action: { targetDeviceId: 'd2', command: 'turn_on' as const }
  });

  // ---------------------------------------------------------------------------
  // Create (existentes)
  // ---------------------------------------------------------------------------

  it('createRule: debe retornar 201 en creación exitosa', async () => {
    await setupDevices();
    const req: AuthenticatedHttpRequest = {
      userId: 'user-1',
      params: { homeId: 'home-1' },
      body: {
        name: 'Test Rule',
        trigger: { deviceId: 'd1', stateKey: 'contact', expectedValue: 'open' },
        action: { deviceId: 'd2', command: 'turn_on' as const }
      }
    };

    const res = await controller.createRule(req);
    expect(res.statusCode).toBe(201);
    const body = bodyAs<AutomationRule>(res);
    expect(body.id).toBe('rule-123');
  });

  it('createRule: debe retornar 400 si el body es inválido (falta campo)', async () => {
    const req: AuthenticatedHttpRequest = {
      userId: 'user-1',
      params: { homeId: 'home-1' },
      body: { name: 'Invalid' }
    };
    const res = await controller.createRule(req);
    expect(res.statusCode).toBe(400);
  });

  it('createRule: debe retornar 400 si expectedValue no es un tipo primitivo válido', async () => {
    const req: AuthenticatedHttpRequest = {
      userId: 'user-1',
      params: { homeId: 'home-1' },
      body: {
        name: 'Invalid Type',
        trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: { o: 'b' } },
        action: { deviceId: 'd2', command: 'turn_on' as const }
      }
    };
    const res = await controller.createRule(req);
    expect(res.statusCode).toBe(400);
    const body = bodyAs<{ message: string }>(res);
    expect(body.message).toContain('expectedValue');
  });

  // ---------------------------------------------------------------------------
  // List / Delete (existentes)
  // ---------------------------------------------------------------------------

  it('listRules: debe retornar 200 con el listado de reglas del hogar', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = { userId: 'user-1', params: { homeId: 'home-1' } };
    const res = await controller.listRules(req);
    expect(res.statusCode).toBe(200);
    const body = bodyAs<AutomationRule[]>(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(topologyMock.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-1');
  });

  it('deleteRule: debe retornar 204 ante eliminación exitosa', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = { userId: 'user-1', params: { ruleId: 'r1' } };
    const res = await controller.deleteRule(req);
    expect(res.statusCode).toBe(204);
  });

  it('deleteRule: debe retornar 404 si la regla no existe', async () => {
    const req: AuthenticatedHttpRequest = { userId: 'user-1', params: { ruleId: 'non-existent' } };
    const res = await controller.deleteRule(req);
    expect(res.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // enableRule
  // ---------------------------------------------------------------------------

  it('enableRule: debe retornar 200 con la regla habilitada', async () => {
    await ruleRepo.save({
      id: 'r1', homeId: 'home-1', userId: 'u1', name: 'Disabled', enabled: false,
      trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: 'v' },
      action: { targetDeviceId: 'd2', command: 'turn_on' as const }
    });
    const req: AuthenticatedHttpRequest = { userId: 'u1', params: { ruleId: 'r1' } };
    const res = await controller.enableRule(req);
    expect(res.statusCode).toBe(200);
    const body = bodyAs<AutomationRule>(res);
    expect(body.enabled).toBe(true);
  });

  it('enableRule: debe retornar 404 si la regla no existe', async () => {
    const req: AuthenticatedHttpRequest = { userId: 'u1', params: { ruleId: 'ghost' } };
    const res = await controller.enableRule(req);
    expect(res.statusCode).toBe(404);
  });

  it('enableRule: debe retornar 403 si el usuario no tiene ownership', async () => {
    await saveBaseRule();
    topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
    const req: AuthenticatedHttpRequest = { userId: 'intruder', params: { ruleId: 'r1' } };
    const res = await controller.enableRule(req);
    expect(res.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // disableRule
  // ---------------------------------------------------------------------------

  it('disableRule: debe retornar 200 con la regla deshabilitada', async () => {
    await saveBaseRule(); // enabled: true
    const req: AuthenticatedHttpRequest = { userId: 'u1', params: { ruleId: 'r1' } };
    const res = await controller.disableRule(req);
    expect(res.statusCode).toBe(200);
    const body = bodyAs<AutomationRule>(res);
    expect(body.enabled).toBe(false);
  });

  it('disableRule: debe retornar 404 si la regla no existe', async () => {
    const req: AuthenticatedHttpRequest = { userId: 'u1', params: { ruleId: 'ghost' } };
    const res = await controller.disableRule(req);
    expect(res.statusCode).toBe(404);
  });

  it('disableRule: debe retornar 403 si el usuario no tiene ownership', async () => {
    await saveBaseRule();
    topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
    const req: AuthenticatedHttpRequest = { userId: 'intruder', params: { ruleId: 'r1' } };
    const res = await controller.disableRule(req);
    expect(res.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // updateRule
  // ---------------------------------------------------------------------------

  it('updateRule: debe retornar 200 con la regla actualizada', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = {
      userId: 'u1',
      params: { ruleId: 'r1' },
      body: { name: 'Nombre Actualizado' }
    };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(200);
    const body = bodyAs<AutomationRule>(res);
    expect(body.name).toBe('Nombre Actualizado');
  });

  it('updateRule: debe retornar 400 si el body está vacío', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = { userId: 'u1', params: { ruleId: 'r1' }, body: {} };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(400);
  });

  it('updateRule: debe retornar 400 si trigger.expectedValue no es un tipo primitivo válido', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = {
      userId: 'u1',
      params: { ruleId: 'r1' },
      body: {
        trigger: { deviceId: 'd1', stateKey: 'k', expectedValue: { nested: 'object' } }
      }
    };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(400);
    const body = bodyAs<{ message: string }>(res);
    expect(body.message).toContain('expectedValue');
  });

  it('updateRule: debe retornar 404 si la regla no existe', async () => {
    const req: AuthenticatedHttpRequest = {
      userId: 'u1',
      params: { ruleId: 'ghost' },
      body: { name: 'X' }
    };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(404);
  });

  it('updateRule: debe retornar 403 si el usuario no tiene ownership', async () => {
    await saveBaseRule();
    topologyMock.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Forbidden'));
    const req: AuthenticatedHttpRequest = {
      userId: 'intruder',
      params: { ruleId: 'r1' },
      body: { name: 'X' }
    };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(403);
  });

  it('updateRule: debe retornar 400 si action.command es inválido', async () => {
    await saveBaseRule();
    const req: AuthenticatedHttpRequest = {
      userId: 'u1',
      params: { ruleId: 'r1' },
      body: {
        action: { deviceId: 'd2', command: 'fly_to_moon' }
      }
    };
    const res = await controller.updateRule(req);
    expect(res.statusCode).toBe(400);
  });
});
