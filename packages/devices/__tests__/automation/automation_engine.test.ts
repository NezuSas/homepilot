import { AutomationEngine } from '../../../automation/application/AutomationEngine';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { SceneRepository } from '../../domain/repositories/SceneRepository';
import { AutomationCommandDispatcher } from '../../../automation/application/AutomationEngine';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';

describe('Automation Engine: Reactive Execution', () => {
  let engine: AutomationEngine;
  let ruleRepo: InMemoryAutomationRuleRepository;
  let logRepo: InMemoryActivityLogRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let sceneRepoMock: jest.Mocked<SceneRepository>;
  let dispatcherMock: jest.Mocked<AutomationCommandDispatcher>;

  beforeEach(() => {
    ruleRepo = new InMemoryAutomationRuleRepository();
    logRepo = new InMemoryActivityLogRepository();
    deviceRepo = new InMemoryDeviceRepository();

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

    engine = new AutomationEngine(
      ruleRepo,
      deviceRepo,
      sceneRepoMock,
      dispatcherMock,
      logRepo
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
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
    });
  };

  it('debe disparar la ejecución automática ante cambios de estado coincidentes', async () => {
    await setupData();

    await engine.handleSystemEvent({ 
      eventId: 'evt1', 
      occurredAt: new Date().toISOString(), 
      source: 'home_assistant', 
      deviceId: 'sensor-1', 
      externalId: 'ext1', 
      newState: { state: 'on' } 
    });

    expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));

    const logs = await logRepo.findRecentByDeviceId('light-1', 1);
    expect(logs[0].description).toBe('Triggered by Automation: AutoLight');
    expect(logs[0].type).toBe('COMMAND_DISPATCHED');
  });

  it('debe garantizar aislamiento de fallos: el log AUTOMATION_FAILED debe incluir el nombre de la regla', async () => {
    await setupData();
    await ruleRepo.save({
      id: 'rule-fail', homeId: 'home-1', userId: 'user-admin', name: 'BrokenRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { type: 'device_command', targetDeviceId: 'non-existent', command: 'turn_on' }
    });

    await engine.handleSystemEvent({ 
      eventId: 'evt2', 
      occurredAt: new Date().toISOString(), 
      source: 'home_assistant', 
      deviceId: 'sensor-1', 
      externalId: 'ext1', 
      newState: { state: 'on' } 
    });

    expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));

    const failLogs = await logRepo.findRecentByDeviceId('non-existent', 1);
    expect(failLogs).toHaveLength(1);
    expect(failLogs[0].type).toBe('AUTOMATION_FAILED');
    expect(failLogs[0].description).toContain('BrokenRule');
  });

  it('no debe ejecutar la acción si la regla está deshabilitada (enabled:false)', async () => {
    await setupData();
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: false,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
    });

    await engine.handleSystemEvent({ 
      eventId: 'evt3', 
      occurredAt: new Date().toISOString(), 
      source: 'home_assistant', 
      deviceId: 'sensor-1', 
      externalId: 'ext1', 
      newState: { state: 'on' } 
    });

    expect(dispatcherMock.dispatchCommand).not.toHaveBeenCalled();
  });

  it('vuelve a ejecutar la acción cuando la regla es reactivada (enabled:true)', async () => {
    await setupData();
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: false,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
    });

    await engine.handleSystemEvent({ 
      eventId: 'evt4', 
      occurredAt: new Date().toISOString(), 
      source: 'home_assistant', 
      deviceId: 'sensor-1', 
      externalId: 'ext1', 
      newState: { state: 'on' } 
    });
    expect(dispatcherMock.dispatchCommand).not.toHaveBeenCalled();

    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'user-admin', name: 'AutoLight', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'presence', expectedValue: true },
      action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
    });

    await engine.handleSystemEvent({ 
      eventId: 'evt5', 
      occurredAt: new Date().toISOString(), 
      source: 'home_assistant', 
      deviceId: 'sensor-1', 
      externalId: 'ext1', 
      newState: { state: 'on' } 
    });
    expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));
  });
});
