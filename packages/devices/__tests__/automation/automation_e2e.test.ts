import { AutomationEngine } from '../../application/automation/AutomationEngine';
import { AutomationController } from '../../api/controllers/AutomationController';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { DeviceCommandDispatcherPort } from '../../application/ports/DeviceCommandDispatcherPort';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { DeviceEventPublisher } from '../../domain/events/DeviceEventPublisher';
import { AuthenticatedHttpRequest } from '../../../topology/api/core/http';

describe('Automation E2E: Full Reactive Flow', () => {
  let ruleRepo: InMemoryAutomationRuleRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let logRepo: InMemoryActivityLogRepository;
  let dispatcherMock: jest.Mocked<DeviceCommandDispatcherPort>;
  let topologyMock: jest.Mocked<TopologyReferencePort>;
  
  let controller: AutomationController;
  let engine: AutomationEngine;

  const clock = { now: () => '2026-03-30T10:00:00Z' };
  const idGen = { generate: () => 'e2e-rule-id' };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    deviceRepo = new InMemoryDeviceRepository();
    // InMemoryActivityLogRepository no recibe argumentos en el constructor
    logRepo = new InMemoryActivityLogRepository();
    
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(undefined) };
    topologyMock = { 
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined), 
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
    const publisherMock = { publish: jest.fn().mockResolvedValue(undefined) };

    controller = new AutomationController(ruleRepo, deviceRepo, topologyMock, idGen);
    
    // Inyección de dependencias consistente con el nuevo constructor posicional
    engine = new AutomationEngine(
      ruleRepo,
      logRepo,
      idGen,
      clock,
      {
        deviceRepository: deviceRepo,
        eventPublisher: publisherMock,
        topologyPort: topologyMock,
        dispatcherPort: dispatcherMock,
        activityLogRepository: logRepo,
        idGenerator: idGen,
        clock: clock
      }
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
        trigger: { deviceId: 'sensor-e2e', stateKey: 'contact', expectedValue: 'open' },
        action: { deviceId: 'light-e2e', command: 'turn_on' as const }
      }
    };
    const createRes = await controller.createRule(createReq);
    expect(createRes.statusCode).toBe(201);

    await engine.handleDeviceStateUpdated({
      deviceId: 'sensor-e2e',
      newState: { contact: 'open' }
    }, 'correlation-e2e');

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith('light-e2e', 'turn_on');

    const logs = await logRepo.findRecentByDeviceId('light-e2e', 5);
    const automationLog = logs.find(l => l.type === 'COMMAND_DISPATCHED');
    expect(automationLog).toBeDefined();
    expect(automationLog?.description).toBe('Triggered by Automation: Welcome Light');
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
      trigger: { deviceId: 'trigger-dev', stateKey: 'k', expectedValue: 1 },
      action: { targetDeviceId: 'target-incompatible', command: 'turn_on' as const }
    });

    await engine.handleDeviceStateUpdated({
      deviceId: 'trigger-dev',
      newState: { k: 1 }
    }, 'corr-fail');

    const logs = await logRepo.findRecentByDeviceId('target-incompatible', 1);
    expect(logs[0].type).toBe('AUTOMATION_FAILED');
    expect(logs[0].description).toContain('Bad Cap Rule');
  });
});
