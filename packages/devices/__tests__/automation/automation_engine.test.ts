import { AutomationEngine } from '../../application/automation/AutomationEngine';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { DeviceCommandDispatcherPort } from '../../application/ports/DeviceCommandDispatcherPort';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { DeviceEventPublisher } from '../../domain/events/DeviceEventPublisher';

describe('Automation Engine: Reactive Execution', () => {
  let engine: AutomationEngine;
  let ruleRepo: InMemoryAutomationRuleRepository;
  let logRepo: InMemoryActivityLogRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let dispatcherMock: jest.Mocked<DeviceCommandDispatcherPort>;
  let topologyMock: jest.Mocked<TopologyReferencePort>;
  let publisherMock: jest.Mocked<DeviceEventPublisher>;

  const idGen = { generate: () => 'new-id' };
  const clock = { now: () => '2026-03-30T00:00:00Z' };

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    logRepo = new InMemoryActivityLogRepository();
    deviceRepo = new InMemoryDeviceRepository();

    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(undefined) };

    topologyMock = {
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    publisherMock = { publish: jest.fn().mockResolvedValue(undefined) };

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

  const setupData = async () => {
    await deviceRepo.saveDevice({
      id: 'sensor-1', homeId: 'home-1', roomId: 'r1', externalId: 'ext1',
      name: 'Sensor', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: { presence: false }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'light-1', homeId: 'home-1', roomId: 'r1', externalId: 'ext2',
      name: 'Light', type: 'light', vendor: 'v', status: 'ASSIGNED',
      lastKnownState: { power: 'off' }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: true,
      trigger: { deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { targetDeviceId: 'light-1', command: 'turn_on' as const }
    });
  };

  it('debe disparar la ejecución automática ante cambios de estado coincidentes', async () => {
    await setupData();

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'correlation-123');

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith('light-1', 'turn_on');

    const logs = await logRepo.findRecentByDeviceId('light-1', 1);
    expect(logs[0].description).toBe('Triggered by Automation: AutoLight');
    expect(logs[0].type).toBe('COMMAND_DISPATCHED');
  });

  it('debe garantizar aislamiento de fallos: el log AUTOMATION_FAILED debe incluir el nombre de la regla', async () => {
    await setupData();
    await ruleRepo.save({
      id: 'rule-fail', homeId: 'home-1', userId: 'user-admin', name: 'BrokenRule', enabled: true,
      trigger: { deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { targetDeviceId: 'non-existent', command: 'turn_on' as const }
    });

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'correlation-123');

    expect(dispatcherMock.dispatch).toHaveBeenCalledWith('light-1', 'turn_on');

    const failLogs = await logRepo.findRecentByDeviceId('non-existent', 1);
    expect(failLogs).toHaveLength(1);
    expect(failLogs[0].type).toBe('AUTOMATION_FAILED');
    expect(failLogs[0].description).toContain('BrokenRule');
    expect(failLogs[0].description).toContain('Reason:');
  });

  it('debe inyectar el userId original de la regla para mantener Zero-Trust', async () => {
    await setupData();

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'corr-1');

    expect(topologyMock.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-admin');
  });

  // ---------------------------------------------------------------------------
  // Compatibilidad con el ciclo de vida: enabled:false / enabled:true
  // ---------------------------------------------------------------------------

  it('no debe ejecutar la acción si la regla está deshabilitada (enabled:false)', async () => {
    await setupData();
    // Reemplazar la regla habilitada por una deshabilitada (save como upsert)
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: false,
      trigger: { deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { targetDeviceId: 'light-1', command: 'turn_on' as const }
    });

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'corr-disabled');

    // El dispatcher no debe ser invocado: la regla está excluida del resultado de findByTriggerDevice
    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();
  });

  it('vuelve a ejecutar la acción cuando la regla es reactivada (enabled:true)', async () => {
    await setupData();
    // Primero deshabilitar
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: false,
      trigger: { deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { targetDeviceId: 'light-1', command: 'turn_on' as const }
    });

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'corr-1');
    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();

    // Reactivar
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: true,
      trigger: { deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { targetDeviceId: 'light-1', command: 'turn_on' as const }
    });

    await engine.handleDeviceStateUpdated({ deviceId: 'sensor-1', newState: { presence: true } }, 'corr-2');
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith('light-1', 'turn_on');
  });
});
