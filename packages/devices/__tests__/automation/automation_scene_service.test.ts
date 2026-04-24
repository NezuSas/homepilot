/**
 * AutomationEngine integration tests via SceneExecutionService.
 *
 * Estos tests validan que el flujo de ejecución de automatizaciones pasa
 * por SceneExecutionService → DeviceCommandService (DeviceCommandDispatcherPort),
 * sin llamar a drivers directamente.
 */
import { SceneExecutionService } from '../../application/SceneExecutionService';
import { AutomationEngine, AutomationCommandDispatcher } from '../../../../packages/automation/application/AutomationEngine';
import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryActivityLogRepository } from '../../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceRepository } from '../../infrastructure/repositories/InMemoryDeviceRepository';
import type { DeviceCommandDispatcherPort } from '../../application/ports/DeviceCommandDispatcherPort';
import type { DeviceCommandRequest } from '../../domain/commands';
import type { DeviceCommandV1 } from '../../domain/commands';
import type { SceneRepository } from '../../domain/repositories/SceneRepository';
import type { SystemVariableService } from '../../../../packages/system-vars/application/SystemVariableService';

/**
 * Construye el AutomationCommandDispatcher del assembler usando SceneExecutionService.
 * Replica la lógica de buildAutomationModule sin depender de infraestructura real.
 */
function buildTestAutomationDispatcher(commandDispatcher: DeviceCommandDispatcherPort): AutomationCommandDispatcher {
  const sceneExecutionService = new SceneExecutionService(commandDispatcher);

  return {
    dispatchCommand: async (homeId: string, deviceId: string, command: string, correlationId: string) => {
      const result = await sceneExecutionService.execute({
        id: `automation:${correlationId}`,
        homeId,
        roomId: null,
        name: `[Auto] ${command}`,
        actions: [{
          deviceId,
          command: {
            name: command as DeviceCommandV1,
            metadata: { source: 'automation', correlationId },
          },
        }],
        executionMode: 'parallel',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (result.status === 'failed') {
        const failedAction = result.actions[0];
        throw new Error(failedAction?.error ?? `Command ${command} failed on device ${deviceId}`);
      }
    },

    executeScene: async (_homeId: string, _sceneId: string, _correlationId: string) => {
      // minimal stub — covered by SceneExecutionService unit tests
    },
  };
}

describe('Automation → SceneExecutionService integration', () => {
  let commandDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let ruleRepo: InMemoryAutomationRuleRepository;
  let logRepo: InMemoryActivityLogRepository;
  let deviceRepo: InMemoryDeviceRepository;
  let sceneRepoMock: jest.Mocked<SceneRepository>;
  let systemVarServiceMock: jest.Mocked<SystemVariableService>;
  let engine: AutomationEngine;

  beforeEach(() => {
    commandDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    ruleRepo = new InMemoryAutomationRuleRepository();
    logRepo = new InMemoryActivityLogRepository();
    deviceRepo = new InMemoryDeviceRepository();

    sceneRepoMock = {
      findSceneById: jest.fn().mockResolvedValue(null),
      findScenesByHomeId: jest.fn().mockResolvedValue([]),
      saveScene: jest.fn(),
      deleteScene: jest.fn(),
    };

    systemVarServiceMock = {
      getSystemTimezone: jest.fn().mockResolvedValue('UTC'),
      get: jest.fn(),
      list: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      purgeExpired: jest.fn(),
    } as unknown as jest.Mocked<SystemVariableService>;

    const automationDispatcher = buildTestAutomationDispatcher(commandDispatcher);

    engine = new AutomationEngine(
      ruleRepo,
      deviceRepo,
      sceneRepoMock,
      automationDispatcher,
      logRepo,
      systemVarServiceMock,
      { generate: () => 'test-id' }
    );
  });

  const addDevice = async (id: string, homeId = 'home-1') => {
    await deviceRepo.saveDevice({
      id, homeId, roomId: 'r1', externalId: `ext-${id}`,
      name: id, type: 'switch', vendor: 'v', status: 'ASSIGNED',
      integrationSource: 'ha', invertState: false,
      // 'unknown' evita que el skip-by-state del AutomationEngine salte comandos turn_on/turn_off
      lastKnownState: { state: 'unknown' }, entityVersion: 1, createdAt: '', updatedAt: ''
    });
  };

  it('automatización ejecuta acciones via SceneExecutionService (dispatch es llamado)', async () => {
    await addDevice('light-1');
    await ruleRepo.save({
      id: 'rule-1', homeId: 'home-1', userId: 'u1', name: 'AutoRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-1', stateKey: 'state', expectedValue: 'on' },
      action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' },
    });

    await engine.handleSystemEvent({
      eventId: 'evt-1', occurredAt: new Date().toISOString(),
      source: 'home_assistant', deviceId: 'sensor-1', externalId: 'ext-s1',
      newState: { state: 'on' },
    });

    expect(commandDispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('metadata source="automation" se propaga al dispatch correctamente', async () => {
    await addDevice('light-2');
    await ruleRepo.save({
      id: 'rule-2', homeId: 'home-1', userId: 'u1', name: 'MetaRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-2', stateKey: 'state', expectedValue: 'on' },
      action: { type: 'device_command', targetDeviceId: 'light-2', command: 'turn_off' },
    });

    await engine.handleSystemEvent({
      eventId: 'evt-2', occurredAt: new Date().toISOString(),
      source: 'home_assistant', deviceId: 'sensor-2', externalId: 'ext-s2',
      newState: { state: 'on' },
    });

    const dispatched = commandDispatcher.dispatch.mock.calls[0][1] as DeviceCommandRequest;
    expect(dispatched.metadata?.source).toBe('automation');
    expect(dispatched.metadata?.correlationId).toMatch(/^auto-evt-/);
  });

  it('fallo en dispatch no rompe la ejecucion global — engine captura el error', async () => {
    commandDispatcher.dispatch.mockRejectedValueOnce(new Error('Capability validation failed'));

    await addDevice('broken-dev');
    await ruleRepo.save({
      id: 'rule-fail', homeId: 'home-1', userId: 'u1', name: 'FailRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'trig-1', stateKey: 'state', expectedValue: 'on' },
      action: { type: 'device_command', targetDeviceId: 'broken-dev', command: 'turn_on' },
    });

    // No debe lanzar excepción globalmente
    await expect(engine.handleSystemEvent({
      eventId: 'evt-fail', occurredAt: new Date().toISOString(),
      source: 'home_assistant', deviceId: 'trig-1', externalId: 'ext-t1',
      newState: { state: 'on' },
    })).resolves.not.toThrow();
  });

  it('DeviceCommandService es llamado (no drivers directos)', async () => {
    await addDevice('ha-device');
    await ruleRepo.save({
      id: 'rule-ha', homeId: 'home-1', userId: 'u1', name: 'HaRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'sensor-ha', stateKey: 'state', expectedValue: 'on' },
      action: { type: 'device_command', targetDeviceId: 'ha-device', command: 'turn_on' },
    });

    await engine.handleSystemEvent({
      eventId: 'evt-ha', occurredAt: new Date().toISOString(),
      source: 'home_assistant', deviceId: 'sensor-ha', externalId: 'ext-sha',
      newState: { state: 'on' },
    });

    expect(commandDispatcher.dispatch).toHaveBeenCalled();
    expect(commandDispatcher.dispatch.mock.calls[0][0]).toBe('ha-device');
  });

  it('resultado agregado correcto — COMMAND_DISPATCHED log creado tras éxito', async () => {
    await addDevice('ok-device');
    await ruleRepo.save({
      id: 'rule-ok', homeId: 'home-1', userId: 'u1', name: 'OkRule', enabled: true,
      trigger: { type: 'device_state_changed', deviceId: 'trigger-ok', stateKey: 'state', expectedValue: 'on' },
      action: { type: 'device_command', targetDeviceId: 'ok-device', command: 'toggle' },
    });

    await engine.handleSystemEvent({
      eventId: 'evt-ok', occurredAt: new Date().toISOString(),
      source: 'home_assistant', deviceId: 'trigger-ok', externalId: 'ext-tok',
      newState: { state: 'on' },
    });

    const logs = await logRepo.findRecentByDeviceId('ok-device', 1);
    expect(logs[0].type).toBe('COMMAND_DISPATCHED');
    expect(commandDispatcher.dispatch).toHaveBeenCalledWith('ok-device', expect.objectContaining({
      name: 'toggle',
      metadata: expect.objectContaining({ source: 'automation' }),
    }));
  });
});
