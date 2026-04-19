import { AutomationEngine } from '../../../automation/application/AutomationEngine';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { SceneRepository } from '../../domain/repositories/SceneRepository';
import { AutomationCommandDispatcher } from '../../../automation/application/AutomationEngine';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import { SystemVariableService } from '../../../system-vars/application/SystemVariableService';
import { DateTime, Settings } from 'luxon';

describe('Automation Engine: Reactive Execution', () => {
  let engine: AutomationEngine;
  let ruleRepo: InMemoryAutomationRuleRepository;
  let logRepo: InMemoryActivityLogRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let sceneRepoMock: jest.Mocked<SceneRepository>;
  let dispatcherMock: jest.Mocked<AutomationCommandDispatcher>;
  let systemVarServiceMock: jest.Mocked<SystemVariableService>;

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

    systemVarServiceMock = {
      getSystemTimezone: jest.fn().mockResolvedValue('UTC'),
      get: jest.fn(),
      list: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      purgeExpired: jest.fn()
    } as any;

    // Ensure luxon uses the mocked Date.now()
    Settings.now = () => Date.now();

    engine = new AutomationEngine(
      ruleRepo,
      deviceRepo,
      sceneRepoMock,
      dispatcherMock,
      logRepo,
      systemVarServiceMock,
      { generate: () => 'test-id' }
    );
  });

  const setupData = async () => {
    await deviceRepo.saveDevice({
      id: 'sensor-1', homeId: 'home-1', roomId: 'r1', externalId: 'ext1',
      name: 'Sensor', type: 'sensor', vendor: 'v', status: 'ASSIGNED',
      integrationSource: 'ha', invertState: false,
      lastKnownState: { presence: false }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
    await deviceRepo.saveDevice({
      id: 'light-1', homeId: 'home-1', roomId: 'r1', externalId: 'ext2',
      name: 'Light', type: 'light', vendor: 'v', status: 'ASSIGNED',
      integrationSource: 'ha', invertState: false,
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
      newState: { state: 'on', attributes: { presence: true } } 
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
      newState: { state: 'on', attributes: { presence: true } } 
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
      newState: { state: 'on', attributes: { presence: true } } 
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
      newState: { state: 'on', attributes: { presence: true } } 
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
      newState: { state: 'on', attributes: { presence: true } } 
    });
    expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));
  });

  describe('Scheduled Triggers (Timezone Consistency)', () => {
    it('debe disparar una regla programada basado en la hora local del equipo (Ecuador UTC-5)', async () => {
      await setupData();
      systemVarServiceMock.getSystemTimezone.mockResolvedValue('America/Guayaquil');
      
      // Mock "now" to a fixed moment
      const mockNow = DateTime.fromObject({ year: 2026, month: 4, day: 20, hour: 10, minute: 30 }, { zone: 'America/Guayaquil' });
      jest.useFakeTimers();
      jest.setSystemTime(mockNow.toJSDate());

      const timeStr = '10:30';
      const dayEcuador = 1; // Monday

      await ruleRepo.save({
        id: 'rule-time-1', homeId: 'home-1', userId: 'u1', name: 'MorningLight', enabled: true,
        trigger: { type: 'time', timeLocal: timeStr, timezone: 'America/Guayaquil', timeUTC: '15:30', days: [dayEcuador] },
        action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
      });

      // Pass UTC pulse
      await engine.handleTimeEvent('15:30');

      expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));
      
      jest.useRealTimers();
    });

    it('debe disparar si el día local coincide EXCLUSIVAMENTE (Cruce de Medianoche UTC)', async () => {
      await setupData();
      // Setup: System in Ecuador (UTC-5). 
      // Rule scheduled for MONDAY 23:30.
      // In UTC, this is TUESDAY 04:30.
      
      systemVarServiceMock.getSystemTimezone.mockResolvedValue('America/Guayaquil');
      
      // Mock "now" to be Monday 23:30 in Ecuador
      const mockNow = DateTime.fromObject({ year: 2026, month: 4, day: 20, hour: 23, minute: 30 }, { zone: 'America/Guayaquil' });
      // Monday = 1
      
      jest.useFakeTimers();
      jest.setSystemTime(mockNow.toJSDate());

      await ruleRepo.save({
        id: 'rule-monday', homeId: 'home-1', userId: 'u1', name: 'LateNightMonday', enabled: true,
        trigger: { type: 'time', timeLocal: '23:30', timezone: 'America/Guayaquil', timeUTC: '04:30', days: [1] }, // Monday
        action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
      });

      // Heartbeat fires at 04:30 UTC (which is Tuesday in UTC, but Monday 23:30 in Ecuador)
      await engine.handleTimeEvent('04:30');

      // SHOULD fire because it's still Monday in Ecuador
      expect(dispatcherMock.dispatchCommand).toHaveBeenCalledWith('home-1', 'light-1', 'turn_on', expect.any(String));
      
      jest.useRealTimers();
    });

    it('NO debe disparar si el día local es TUESDAY pero la regla es para MONDAY (seguridad cruce)', async () => {
      await setupData();
      systemVarServiceMock.getSystemTimezone.mockResolvedValue('America/Guayaquil');
      
      // Mock "now" to be TUESDAY 00:30 in Ecuador (Monday is over)
      const mockNow = DateTime.fromObject({ year: 2026, month: 4, day: 21, hour: 0, minute: 30 }, { zone: 'America/Guayaquil' });
      // Tuesday = 2
      
      jest.useFakeTimers();
      jest.setSystemTime(mockNow.toJSDate());

      await ruleRepo.save({
        id: 'rule-monday-only', homeId: 'h1', userId: 'u1', name: 'MondayOnly', enabled: true,
        trigger: { type: 'time', timeLocal: '23:30', timezone: 'America/Guayaquil', timeUTC: '04:30', days: [1] }, // Monday
        action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' }
      });

      // Heartbeat fires at some time, but it's Tuesday 00:30 local. 
      await engine.handleTimeEvent('05:30'); 

      expect(dispatcherMock.dispatchCommand).not.toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
});
