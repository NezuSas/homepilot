import { AssistantMemoryService } from '../application/AssistantMemoryService';
import { AssistantMemoryRepository, AssistantMemoryRecord } from '../domain/repositories/AssistantMemoryRepository';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';

describe('AssistantMemoryService V2', () => {
  let mockMemoryRepo: jest.Mocked<AssistantMemoryRepository>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;
  let service: AssistantMemoryService;

  beforeEach(() => {
    mockMemoryRepo = {
      upsert: jest.fn(),
      findByKey: jest.fn(),
      listByPrefix: jest.fn(),
      delete: jest.fn(),
      deleteExpired: jest.fn(),
    };
    mockExecutionRepo = {
      save: jest.fn(),
      findRecent: jest.fn(),
      findBySource: jest.fn(),
      findById: jest.fn(),
    };
    service = new AssistantMemoryService(mockExecutionRepo, mockMemoryRepo);
  });

  it('should save and retrieve short term memory', async () => {
    const state = {
      lastQueryType: 'test',
      entities: [{ id: '1', name: 'Dev 1', type: 'light', roomId: 'room-1' }],
      timestamp: '2026-04-27T12:00:00Z'
    };

    await service.saveShortTermMemory('user-1', state);
    expect(mockMemoryRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      key: 'short_term_context',
      valueType: 'json'
    }));

    mockMemoryRepo.findByKey.mockResolvedValue({
      userId: 'user-1',
      key: 'short_term_context',
      value: JSON.stringify(state),
      valueType: 'json',
      expiresAt: null,
      createdAt: '',
      updatedAt: ''
    });

    const retrieved = await service.getShortTermMemory('user-1');
    expect(retrieved).toEqual(state);
  });

  it('should save and retrieve user preferences', async () => {
    await service.setUserPreference('user-1', 'tone', 'casual');
    expect(mockMemoryRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      key: 'pref:tone',
      value: 'casual'
    }));

    mockMemoryRepo.findByKey.mockResolvedValue({
      userId: 'user-1',
      key: 'pref:tone',
      value: 'casual',
      valueType: 'string',
      expiresAt: null,
      createdAt: '',
      updatedAt: ''
    });

    const tone = await service.getUserPreference('user-1', 'tone');
    expect(tone).toBe('casual');
  });

  it('should handle aliases', async () => {
    await service.setAlias('user-1', 'mi cuarto', 'room-1');
    expect(mockMemoryRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      key: 'alias:mi cuarto',
      value: 'room-1'
    }));

    mockMemoryRepo.listByPrefix.mockResolvedValue([
      { userId: 'user-1', key: 'alias:mi cuarto', value: 'room-1', valueType: 'string', expiresAt: null, createdAt: '', updatedAt: '' }
    ]);

    const aliases = await service.getAliases('user-1');
    expect(aliases).toEqual({ 'mi cuarto': 'room-1' });
  });
});
