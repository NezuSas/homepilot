import { AutomationEngine } from '../../../automation/application/AutomationEngine';
import { AutomationController } from '../../api/controllers/AutomationController';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { SceneRepository } from '../../domain/repositories/SceneRepository';
import { AutomationCommandDispatcher } from '../../../automation/application/AutomationEngine';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { AuthenticatedHttpRequest } from '../../../topology/api/core/http';

describe('Automation E2E: Full Reactive Flow', () => {
  let ruleRepo: InMemoryAutomationRuleRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let logRepo: InMemoryActivityLogRepository;
  let sceneRepoMock: jest.Mocked<SceneRepository>;
  let dispatcherMock: jest.Mocked<AutomationCommandDispatcher>;
  let topologyMock: jest.Mocked<TopologyReferencePort>;
  
  let controller: AutomationController;
  let engine: AutomationEngine;

  const idGen = { generate: () => 'e2e-rule-id' };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    deviceRepo = new InMemoryDeviceRepository();
    logRepo = new InMemoryActivityLogRepository();
    
    dispatcherMock = { 
      dispatchCommand: jest.fn().mockResolvedValue(undefined),
      executeScene: jest.fn().mockResolvedValue({ success: true, results: [] }) 
    };

    sceneRepoMock = {
      findSceneById: jest.fn(),
      findScenesByHomeId: jest.fn(),
      saveScene: jest.fn(),
      deleteScene: jest.fn()
    };

    topologyMock = { 
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined), 
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    controller = new AutomationController(ruleRepo, deviceRepo, topologyMock, idGen);
    
    engine = new AutomationEngine(
      ruleRepo,
      deviceRepo,
      sceneRepoMock,
      dispatcherMock,
      logRepo,
      idGen
    );
  });

  it('debe completar el flujo: crear regla -> trigger por cambio de estado -> ejecución automática -> auditoría', async () => {
    await deviceRepo.saveDevice({
      id: 'sensor-e2e', homeId: 'home-e2e', roomId: 'r1', externalId: 'e1',
      name: 'Sensor', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: { contact: 'closed' }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'light-e2e', homeId: 'home-e2e', roomId: 'r1', externalId: 'e2',
      name: 'Light', type: 'light', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: { power: 'off' }, entityVersion: 1, createdAt: '', updatedAt: ''
    });

    const createReq: AuthenticatedHttpRequest = {
      userId: 'user-manager',
      params: { homeId: 'home-e2e' },
      body: {
        name: 'Welcome Light',
        trigger: { type: 'device_state_changed' as const, deviceId: 'sensor-e2e', stateKey: 'contact', expectedValue: 'open' },
        action: { type: 'device_command' as const, targetDeviceId: 'light-e2e', command: 'turn_on' }
      }
    };
    const createRes = await controller.createRule(createReq);
    expect(createRes.statusCode).toBe(201);

    await engine.handleSystemEvent({
      eventId: 'evt-e2e',
      occurredAt: new Date().toISOString(),
      source: 'home_assistant',
      deviceId: 'sensor-e2e',
      externalId: 'e1',
      newState: { state: 'open', attributes: { contact: 'open' } }
    });

    expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-e2e', 'light-e2e', 'turn_on', expect.any(String));

    const logs = await logRepo.findRecentByDeviceId('light-e2e', 5);
    const automationLog = logs.find(l => l.type === 'COMMAND_DISPATCHED');
    expect(automationLog).toBeDefined();
    expect(automationLog?.description).toContain('Welcome Light');
  });

  it('debe registrar AUTOMATION_FAILED si la ejecución falla por reglas de negocio', async () => {
    await deviceRepo.saveDevice({
      id: 'trigger-dev', homeId: 'h1', roomId: 'r1', externalId: 'ext1',
      name: 'Source', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: { k: 0 }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'target-incompatible', homeId: 'h1', roomId: 'r1', externalId: 'ext2',
      name: 'Incompatible', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: ''
    });

    await ruleRepo.save({
      id: 'rule-incompatible', homeId: 'h1', userId: 'u1', name: 'Bad Cap Rule', enabled: true,
      trigger: { type: 'device_state_changed' as const, deviceId: 'trigger-dev', stateKey: 'k', expectedValue: 1 },
      action: { type: 'device_command' as const, targetDeviceId: 'target-incompatible', command: 'turn_on' as any }
    });

    dispatcherMock.dispatchCommand.mockRejectedValueOnce(new Error('Incompatible Capability'));

    await engine.handleSystemEvent({
      eventId: 'evt-fail',
      occurredAt: new Date().toISOString(),
      source: 'home_assistant',
      deviceId: 'trigger-dev',
      externalId: 'ext1',
      newState: { state: '1', attributes: { k: 1 } }
    });

    const logs = await logRepo.findRecentByDeviceId('target-incompatible', 1);
    expect(logs[0].type).toBe('AUTOMATION_FAILED');
    expect(logs[0].description).toContain('Bad Cap Rule');
  });
});
