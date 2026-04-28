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
});
