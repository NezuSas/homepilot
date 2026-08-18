import { EventEmitter } from 'events';
import { buildAutomationModule } from '../infrastructure/assemblers/buildAutomationModule';
import type { EventBusEvent, EventBusHandler } from '../packages/shared/domain/events/EventBus';
import type { SystemStateChangeEvent } from '../packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

describe('buildAutomationModule', () => {
  it('assembles engine services and wires local events to the automation engine', async () => {
    const syncManager = new EventEmitter() as EventEmitter & { removeAllListeners: jest.Mock };
    syncManager.removeAllListeners = jest.fn();
    const handlers = new Map<string, EventBusHandler>();
    const eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn((type: string, handler: EventBusHandler) => {
        handlers.set(type, handler);
        return () => handlers.delete(type);
      })
    };
    const deps = { automationRuleRepository: {}, deviceRepository: {}, sceneRepository: { findSceneById: jest.fn().mockResolvedValue(null) }, activityLogRepository: { saveActivity: jest.fn() }, executionRecordRepository: {}, commandDispatcher: {}, systemVariableService: {}, syncManager, eventBus };
    const assembled = buildAutomationModule(deps as never);
    const handle = jest.spyOn(assembled.automationEngine, 'handleSystemEvent').mockResolvedValue();

    expect(syncManager.removeAllListeners).toHaveBeenCalledWith('system_event');
    expect(eventBus.subscribe).toHaveBeenCalledWith('DeviceStateUpdatedEvent', expect.any(Function));
    await handlers.get('DeviceStateUpdatedEvent')!({ eventId: 'event-1', eventType: 'DeviceStateUpdatedEvent', schemaVersion: '1', source: 'test', timestamp: '2026-08-17T10:00:00.000Z', correlationId: 'correlation-1', payload: { deviceId: 'device-1', newState: { state: 'on' } } } as EventBusEvent);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ source: 'local_sensor', deviceId: 'device-1', externalId: 'local:device-1' }));
  });
  it('forwards Home Assistant system events to the assembled automation engine', async () => {
    const syncManager = new EventEmitter() as EventEmitter & { removeAllListeners: jest.Mock };
    syncManager.removeAllListeners = jest.fn();
    const eventBus = { publish: jest.fn(), subscribe: jest.fn().mockReturnValue(jest.fn()) };
    const deps = {
      automationRuleRepository: {}, deviceRepository: {}, sceneRepository: { findSceneById: jest.fn() },
      activityLogRepository: { saveActivity: jest.fn() }, executionRecordRepository: {}, commandDispatcher: {},
      systemVariableService: {}, syncManager, eventBus,
    };
    const assembled = buildAutomationModule(deps as never);
    const handle = jest.spyOn(assembled.automationEngine, 'handleSystemEvent').mockResolvedValue();
    const event: SystemStateChangeEvent = {
      eventId: 'ha-event-1', occurredAt: '2026-08-17T10:00:00.000Z', source: 'home_assistant',
      deviceId: 'device-1', externalId: 'light.sala', newState: { state: 'on' },
    };

    syncManager.emit('system_event', event);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(handle).toHaveBeenCalledWith(event);
  });
  it('schedules the self-correcting heartbeat outside test mode and dispatches its UTC minute', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const syncManager = new EventEmitter() as EventEmitter & { removeAllListeners: jest.Mock };
    syncManager.removeAllListeners = jest.fn();
    const eventBus = { publish: jest.fn(), subscribe: jest.fn().mockReturnValue(jest.fn()) };
    const scheduledCallbacks: Array<() => void> = [];
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return { unref: jest.fn() } as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);
    process.env.NODE_ENV = 'development';

    try {
      const assembled = buildAutomationModule({
        automationRuleRepository: {}, deviceRepository: {}, sceneRepository: { findSceneById: jest.fn() },
        activityLogRepository: { saveActivity: jest.fn() }, executionRecordRepository: {}, commandDispatcher: {},
        systemVariableService: {}, syncManager, eventBus,
      } as never);
      const handleTimeEvent = jest.spyOn(assembled.automationEngine, 'handleTimeEvent').mockResolvedValue();

      expect(scheduledCallbacks).toHaveLength(1);
      scheduledCallbacks[0]();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(handleTimeEvent).toHaveBeenCalledWith(expect.stringMatching(/^\d{2}:\d{2}$/), expect.any(Date));
      expect(scheduledCallbacks).toHaveLength(2);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      setTimeoutSpy.mockRestore();
    }
  });
  it('adapts an automation command into a one-action scene executed through the device dispatcher', async () => {
    const syncManager = new EventEmitter() as EventEmitter & { removeAllListeners: jest.Mock };
    syncManager.removeAllListeners = jest.fn();
    const commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const executionRecordRepository = { save: jest.fn().mockResolvedValue(undefined) };
    const eventBus = { publish: jest.fn(), subscribe: jest.fn().mockReturnValue(jest.fn()) };
    const assembled = buildAutomationModule({
      automationRuleRepository: {}, deviceRepository: {}, sceneRepository: { findSceneById: jest.fn() },
      activityLogRepository: { saveActivity: jest.fn() }, executionRecordRepository, commandDispatcher,
      systemVariableService: {}, syncManager, eventBus,
    } as never);
    const adapter = assembled.automationEngine as unknown as {
      commandDispatcher: { dispatchCommand(homeId: string, deviceId: string, command: string, correlationId: string, ruleId: string): Promise<void> };
    };

    await adapter.commandDispatcher.dispatchCommand('home-1', 'device-1', 'turn_on', 'corr-1', 'rule-1');

    expect(commandDispatcher.dispatch).toHaveBeenCalledWith('device-1', expect.objectContaining({
      name: 'turn_on', metadata: expect.objectContaining({ source: 'automation', correlationId: 'corr-1' }),
    }));
  });
  it('adapts automation scene execution with auditable lifecycle and treats a missing scene as a no-op', async () => {
    const syncManager = new EventEmitter() as EventEmitter & { removeAllListeners: jest.Mock };
    syncManager.removeAllListeners = jest.fn();
    const sceneRepository = {
      findSceneById: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'scene-1', homeId: 'home-1', roomId: null, name: 'Night', executionMode: 'parallel',
          actions: [{ deviceId: 'device-1', command: { name: 'turn_off', params: {} } }], createdAt: '', updatedAt: '',
        }),
    };
    const activityLogRepository = { saveActivity: jest.fn().mockResolvedValue(undefined) };
    const commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const eventBus = { publish: jest.fn(), subscribe: jest.fn().mockReturnValue(jest.fn()) };
    const assembled = buildAutomationModule({
      automationRuleRepository: {}, deviceRepository: {}, sceneRepository, activityLogRepository,
      executionRecordRepository: { save: jest.fn().mockResolvedValue(undefined) }, commandDispatcher,
      systemVariableService: {}, syncManager, eventBus,
    } as never);
    const adapter = assembled.automationEngine as unknown as {
      commandDispatcher: { executeScene(homeId: string, sceneId: string, correlationId: string, ruleId: string): Promise<void> };
    };

    await adapter.commandDispatcher.executeScene('home-1', 'missing', 'corr-missing', 'rule-1');
    expect(activityLogRepository.saveActivity).not.toHaveBeenCalled();

    await adapter.commandDispatcher.executeScene('home-1', 'scene-1', 'corr-scene', 'rule-1');
    expect(commandDispatcher.dispatch).toHaveBeenCalledWith('device-1', expect.objectContaining({ name: 'turn_off' }));
    expect(activityLogRepository.saveActivity).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'SCENE_EXECUTION_STARTED', correlationId: 'corr-scene' }));
    expect(activityLogRepository.saveActivity).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'SCENE_EXECUTION_COMPLETED', correlationId: 'corr-scene' }));
  });
});
