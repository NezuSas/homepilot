import { AssistantLearningService } from '../application/AssistantLearningService';
import { AssistantLearningRepository } from '../domain/repositories/AssistantLearningRepository';
import { AssistantLearningEvent } from '../domain/AssistantLearningEvent';

describe('AssistantLearningService Modifiers', () => {
  let service: AssistantLearningService;
  let repository: jest.Mocked<AssistantLearningRepository>;

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      getMostUsedEntities: jest.fn(),
      getMostUsedRooms: jest.fn(),
      getRecentCorrections: jest.fn(),
      getEventsInTimeRange: jest.fn(),
    } as unknown as jest.Mocked<AssistantLearningRepository>;

    service = new AssistantLearningService(repository);
  });

  it('should return empty modifiers when no data exists', async () => {
    repository.getMostUsedEntities.mockResolvedValue([]);
    repository.getMostUsedRooms.mockResolvedValue([]);
    repository.getRecentCorrections.mockResolvedValue([]);

    const result = await service.computeModifiers('u1');

    expect(result.typeModifiers).toEqual({});
    expect(result.explanations).toEqual({});
  });

  it('should boost automation_suggestion and scene_suggestion when devices are used', async () => {
    repository.getMostUsedEntities.mockResolvedValue([{ entityId: 'd1', count: 10 }]);
    repository.getMostUsedRooms.mockResolvedValue([]);
    repository.getRecentCorrections.mockResolvedValue([]);

    const result = await service.computeModifiers('u1');

    expect(result.typeModifiers['automation_suggestion']).toBe(15);
    expect(result.typeModifiers['scene_suggestion']).toBe(10);
    expect(result.explanations['automation_suggestion']).toContain('uso frecuente');
  });

  it('should boost habit_pattern_detected and energy_waste_detected when rooms are used', async () => {
    repository.getMostUsedEntities.mockResolvedValue([]);
    repository.getMostUsedRooms.mockResolvedValue([{ roomId: 'r1', count: 10 }]);
    repository.getRecentCorrections.mockResolvedValue([]);

    const result = await service.computeModifiers('u1');

    expect(result.typeModifiers['habit_pattern_detected']).toBe(15);
    expect(result.typeModifiers['energy_waste_detected']).toBe(20);
    expect(result.explanations['energy_waste_detected']).toContain('actividad frecuente');
  });

  it('should apply negative boost when corrections with findingType are received', async () => {
    repository.getMostUsedEntities.mockResolvedValue([]);
    repository.getMostUsedRooms.mockResolvedValue([]);
    repository.getRecentCorrections.mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        eventType: 'correction_received',
        entityId: null,
        entityType: null,
        entityName: null,
        roomId: null,
        prompt: 'test',
        correction: 'test',
        metadata: { findingType: 'device_name_technical' },
        createdAt: new Date().toISOString()
      }
    ]);

    const result = await service.computeModifiers('u1');

    expect(result.typeModifiers['device_name_technical']).toBe(-30);
    expect(result.explanations['device_name_technical']).toContain('correcciones recientes');
  });
  it('persists learning events and delegates read queries with the requested scope', async () => {
    const device = {
      id: 'device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'external-1', name: 'Desk light',
      type: 'light', vendor: 'vendor', status: 'ASSIGNED' as const, integrationSource: 'home_assistant', invertState: false,
      lastKnownState: null, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const scene = {
      id: 'scene-1', homeId: 'home-1', roomId: 'room-1', name: 'Movie', actions: [],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const event = {
      id: 'event-1', userId: 'user-1', eventType: 'correction_received' as const, entityId: null,
      entityType: null, entityName: null, roomId: null, prompt: null, correction: 'Use room names', metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    repository.getMostUsedEntities.mockResolvedValue([{ entityId: 'device-1', count: 2 }]);
    repository.getMostUsedRooms.mockResolvedValue([{ roomId: 'room-1', count: 3 }]);
    repository.getRecentCorrections.mockResolvedValue([event]);
    repository.getEventsInTimeRange.mockResolvedValue([event]);

    await service.recordDeviceUsed('user-1', device, 'turn on desk light');
    await service.recordSceneUsed('user-1', scene, 'movie time');
    await service.recordClarificationSelected('user-1', 'device-2', 'Hall light', 'device', 'turn it on');
    await service.recordAliasCreated('user-1', 'desk', 'Desk light');
    await service.recordCorrection('user-1', 'Not that device');
    await service.recordCommandResult('user-1', 'device-1', false, 'offline');
    await service.recordSuggestionResponse('user-1', 'suggestion-1', 'energy', 'postponed');

    expect(repository.save).toHaveBeenCalledTimes(7);
    expect(repository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userId: 'user-1', eventType: 'device_used', entityId: 'device-1', roomId: 'room-1'
    }));
    expect(repository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventType: 'scene_used', entityId: 'scene-1', roomId: 'room-1'
    }));
    expect(repository.save).toHaveBeenNthCalledWith(4, expect.objectContaining({
      eventType: 'alias_created', metadata: { alias: 'desk', targetName: 'Desk light' }
    }));
    expect(repository.save).toHaveBeenNthCalledWith(6, expect.objectContaining({
      eventType: 'command_failed', metadata: { error: 'offline' }
    }));
    expect(repository.save).toHaveBeenNthCalledWith(7, expect.objectContaining({
      eventType: 'suggestion_postponed', metadata: { suggestionId: 'suggestion-1', type: 'energy' }
    }));

    await expect(service.getMostUsedDevices('user-1', 2)).resolves.toEqual([{ entityId: 'device-1', count: 2 }]);
    await expect(service.getMostUsedRooms('user-1', 3)).resolves.toEqual([{ roomId: 'room-1', count: 3 }]);
    await expect(service.getRecentCorrections('user-1', 4)).resolves.toEqual([event]);
    await expect(service.getEventsInTimeRange('user-1', 'start', 'end')).resolves.toEqual([event]);
    expect(repository.getMostUsedEntities).toHaveBeenLastCalledWith('user-1', 'device', 2);
    expect(repository.getMostUsedRooms).toHaveBeenLastCalledWith('user-1', 3);
    expect(repository.getRecentCorrections).toHaveBeenLastCalledWith('user-1', 4);
    expect(repository.getEventsInTimeRange).toHaveBeenCalledWith('user-1', 'start', 'end');
  });
});
