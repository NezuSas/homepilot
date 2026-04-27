import { AssistantMemoryService } from '../application/AssistantMemoryService';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { ExecutionRecord } from '../../devices/domain/ExecutionRecord';
import { AssistantMemoryRepository } from '../domain/repositories/AssistantMemoryRepository';

describe('AssistantMemoryService', () => {
  let mockRepo: jest.Mocked<ExecutionRecordRepository>;
  let mockMemoryRepo: jest.Mocked<AssistantMemoryRepository>;
  let service: AssistantMemoryService;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findRecent: jest.fn(),
      findBySource: jest.fn(),
      findById: jest.fn(),
    };
    mockMemoryRepo = {
      upsert: jest.fn(),
      findByKey: jest.fn(),
      listByPrefix: jest.fn(),
      delete: jest.fn(),
      deleteExpired: jest.fn(),
    };
    service = new AssistantMemoryService(mockRepo, mockMemoryRepo);
  });

  it('should return null when there are no recent actions', async () => {
    mockRepo.findRecent.mockResolvedValue([]);
    const deviceId = await service.getLastDeviceUsed();
    expect(deviceId).toBeNull();
  });

  it('should filter execution records strictly by manual/assistant rule', async () => {
    const mockRecords: ExecutionRecord[] = [
      { // automation no entra
        id: '1', sourceType: 'automation', sourceId: 'rule1', status: 'success',
        startedAt: '', completedAt: '', durationMs: 0, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0,
        actions: [{ deviceId: 'dev-1', commandName: 'turn_on', status: 'success' }]
      },
      { // scene manual normal no entra (porque el sourceId es el ID de la escena, no assistant ni retry)
        id: '2', sourceType: 'manual', sourceId: 'scene-123', status: 'success',
        startedAt: '', completedAt: '', durationMs: 0, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0,
        actions: [{ deviceId: 'dev-2', commandName: 'turn_on', status: 'success' }]
      },
      { // manual assistant sí entra
        id: '3', sourceType: 'manual', sourceId: 'assistant', status: 'success',
        startedAt: '', completedAt: '', durationMs: 0, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0,
        actions: [{ deviceId: 'dev-3', commandName: 'turn_off', status: 'success' }]
      },
      { // manual retry sí entra
        id: '4', sourceType: 'manual', sourceId: 'retry:123', status: 'success',
        startedAt: '', completedAt: '', durationMs: 0, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0,
        actions: [{ deviceId: 'dev-4', commandName: 'turn_on', status: 'success' }]
      },
      { // manual con correlationId assistant sí entra
        id: '5', sourceType: 'manual', sourceId: 'scene-123', correlationId: 'assistant:123', status: 'success',
        startedAt: '', completedAt: '', durationMs: 0, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0,
        actions: [{ deviceId: 'dev-5', commandName: 'turn_on', status: 'success' }]
      }
    ];

    mockRepo.findRecent.mockResolvedValue(mockRecords);

    const recent = await service.getRecentActions(10);
    
    expect(recent.length).toBe(3);
    expect(recent[0].id).toBe('3');
    expect(recent[1].id).toBe('4');
    expect(recent[2].id).toBe('5');
    
    const deviceId = await service.getLastDeviceUsed();
    expect(deviceId).toBe('dev-3');
  });

  it('should limit results correctly', async () => {
    // We mock 20 identical manual records
    const records: ExecutionRecord[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `rec-${i}`,
      sourceType: 'manual',
      sourceId: 'assistant',
      status: 'success',
      startedAt: '',
      completedAt: '',
      durationMs: 0,
      actionCount: 1,
      successCount: 1,
      failedCount: 0,
      skippedCount: 0,
      actions: [{ deviceId: 'dev-1', commandName: 'turn_on', status: 'success' }]
    }));

    mockRepo.findRecent.mockResolvedValue(records);

    const recent = await service.getRecentActions(5);
    expect(recent.length).toBe(5);
    expect(mockRepo.findRecent).toHaveBeenCalledWith(15); // limit * 3
  });
});
