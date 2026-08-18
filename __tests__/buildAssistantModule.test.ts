import * as fs from 'fs';
import { buildAssistantModule } from '../infrastructure/assemblers/buildAssistantModule';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import type { EventBusEvent, EventBusHandler } from '../packages/shared/domain/events/EventBus';

describe('buildAssistantModule', () => {
  const dbPath = 'build-assistant-module.test.db';

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });
  it('assembles assistant services and schedules one debounced scan for each supported topology event', async () => {
    jest.useFakeTimers();
    const handlers = new Map<string, EventBusHandler>();
    const eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn((eventType: string, handler: EventBusHandler) => {
        handlers.set(eventType, handler);
        return () => handlers.delete(eventType);
      }),
    };

    try {
      const assembled = buildAssistantModule({
        dbPath,
        deviceRepository: {},
        roomRepository: {},
        automationRuleRepository: {},
        sceneRepository: {},
        activityLogRepository: {},
        haClientProxy: {},
        eventBus,
      } as never);
      const scan = jest.spyOn(assembled.assistantService, 'scan').mockResolvedValue(undefined);

      expect(assembled.assistantRepository).toBeDefined();
      expect(assembled.assistantFeedbackRepository).toBeDefined();
      expect(assembled.assistantDraftRepository).toBeDefined();
      expect(eventBus.subscribe).toHaveBeenCalledWith('HomeCreatedEvent', expect.any(Function));
      expect(eventBus.subscribe).toHaveBeenCalledWith('RoomCreatedEvent', expect.any(Function));
      expect(eventBus.subscribe).toHaveBeenCalledWith('DeviceDiscoveredEvent', expect.any(Function));

      await handlers.get('HomeCreatedEvent')!({ payload: { id: 'home-1' } } as EventBusEvent);
      await handlers.get('RoomCreatedEvent')!({ payload: { homeId: 'home-1' } } as EventBusEvent);
      await handlers.get('DeviceDiscoveredEvent')!({ payload: { homeId: 'home-1' } } as EventBusEvent);
      jest.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(scan).toHaveBeenCalledTimes(1);
      expect(scan).toHaveBeenCalledWith('home-1', 'event_bus:device_discovered');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule an assistant scan when an event has no home identifier', async () => {
    const handlers = new Map<string, EventBusHandler>();
    const eventBus = { publish: jest.fn(), subscribe: jest.fn((type: string, handler: EventBusHandler) => { handlers.set(type, handler); return jest.fn(); }) };
    const assembled = buildAssistantModule({ dbPath, deviceRepository: {}, roomRepository: {}, automationRuleRepository: {}, sceneRepository: {}, activityLogRepository: {}, haClientProxy: {}, eventBus } as never);
    const scan = jest.spyOn(assembled.assistantService, 'scan').mockResolvedValue(undefined);

    await handlers.get('HomeCreatedEvent')!({ payload: {} } as EventBusEvent);
    await handlers.get('RoomCreatedEvent')!({ payload: {} } as EventBusEvent);
    await handlers.get('DeviceDiscoveredEvent')!({ payload: {} } as EventBusEvent);

    expect(scan).not.toHaveBeenCalled();
  });
});