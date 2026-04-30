import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockIntentInterpreterPort, 
  createMockAssistantSmallTalk, 
  createMockDeviceCommandDispatcher, 
  createMockSmartEntityResolver,
  createMockAssistantMemory,
  createMockAssistantLearningService,
  createMockFollowUpResolver,
  createMockAssistantConfirmationPolicy,
  createMockAssistantSuggestionService,
  createMockExecutionRecordRepository,
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAutomationRuleRepository,
  createMockAssistantDraftService,
  createMockAssistantDraftRepository,
  createTestDevice,
  createMockSceneExecutionService
} from './test_helpers';

describe('Assistant Multi-Target Confirmation Guard', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockDeviceRepo: any;
  let mockShadowService: any;
  let mockSceneExecutionService: any;

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneExecutionService = createMockSceneExecutionService();
    
    mockShadowService = {
      attemptHybridExecution: jest.fn(),
      runShadow: jest.fn().mockResolvedValue(undefined)
    };

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      mockSceneExecutionService,
      mockDispatcher,
      mockDeviceRepo,
      createMockRoomRepository(),
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      mockShadowService
    );

    process.env.ASSISTANT_PLANNER_V2_EXECUTION = 'true';
  });

  afterEach(() => {
    delete process.env.ASSISTANT_PLANNER_V2_EXECUTION;
  });

  it('triggers confirmation when multiple devices are resolved', async () => {
    mockShadowService.attemptHybridExecution.mockResolvedValue({
      command: 'turn_on',
      confidence: 0.9,
      resolvedType: 'multiple',
      resolvedIds: ['d1', 'd2', 'd3']
    });

    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'prende las luces', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 3 dispositivos');
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingBulkAction: expect.objectContaining({
        type: 'bulk_action',
        deviceIds: ['d1', 'd2', 'd3'],
        command: 'turn_on'
      })
    }));
  });

  it('triggers confirmation when a category is resolved', async () => {
    mockShadowService.attemptHybridExecution.mockResolvedValue({
      command: 'turn_off',
      confidence: 0.9,
      resolvedType: 'category',
      resolvedIds: ['d1']
    });

    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 1 dispositivos');
  });

  it('executes all devices when confirmed with "sí"', async () => {
    const devices = [
      createTestDevice({ id: 'd1', name: 'Luz 1', homeId: 'h1' }),
      createTestDevice({ id: 'd2', name: 'Luz 2', homeId: 'h1' })
    ];
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });

    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ['d1', 'd2'],
        command: 'turn_on',
        timestamp: new Date().toISOString(),
        originalPrompt: 'prende las luces'
      }
    });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(2);
    // SHADOW CHECK: verify runShadow was NOT called (it's skipped for bulk actions)
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'command',
      entities: expect.arrayContaining([
        expect.objectContaining({ id: 'd1' }),
        expect.objectContaining({ id: 'd2' })
      ])
    }));
  });

  it('discards pending action and clears memory when cancelled with "no"', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ['d1'],
        command: 'turn_on',
        timestamp: new Date().toISOString(),
        originalPrompt: 'prende las luces'
      }
    });

    const res = await service.converse({ prompt: 'no', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Acción cancelada');
    // Verify memory clear was called with pendingBulkAction: undefined
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingBulkAction: undefined
    }));
    // SHADOW CHECK: verify runShadow was NOT called
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
  });

  it('rejects invalid bulk command and clears memory', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ['d1'],
        command: 'invalid_cmd',
        timestamp: new Date().toISOString(),
        originalPrompt: 'do something'
      }
    });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.type).toBe('error');
    expect(res.message).toContain('inválido');
    // Verify memory clear was called
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingBulkAction: undefined
    }));
  });

  describe('Bulk Fast-Path (Deterministic)', () => {
    it('triggers bulk confirmation for "enciende todas las luces" without calling shadow', async () => {
      const lights = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light' }),
        createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light' })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(lights);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('clarification');
      expect(res.message).toContain('Encontré 2 luces');
      expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
        pendingBulkAction: expect.objectContaining({
          command: 'turn_on',
          deviceIds: ['l1', 'l2']
        })
      }));
    });

    it('triggers bulk confirmation for "apaga todas las luces" without calling shadow', async () => {
      const lights = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light' })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(lights);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'apaga todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('clarification');
      expect(res.message).toContain('Encontré 1 luces');
      expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
        pendingBulkAction: expect.objectContaining({
          command: 'turn_off',
          deviceIds: ['l1']
        })
      }));
    });

    it('returns safe answer if no lights are found', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('answer');
      expect(res.message).toContain('No encontré luces');
    });

    it('excludes unavailable devices from bulk resolution', async () => {
      const devices = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light' }),
        createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light', lastKnownState: { state: 'unavailable' } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('clarification');
      expect(res.message).toContain('Encontré 1 luces');
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
        pendingBulkAction: expect.objectContaining({
          deviceIds: ['l1']
        })
      }));
    });
  });
});
