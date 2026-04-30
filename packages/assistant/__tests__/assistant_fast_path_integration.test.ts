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

describe('Fast Path Integration in AssistantConversationService', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockDeviceRepo: any;
  let mockShadowService: any;
  let mockIntentInterpreter: any;

  beforeEach(() => {
    mockIntentInterpreter = createMockIntentInterpreterPort();
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockShadowService = { 
      runShadow: jest.fn().mockResolvedValue(undefined),
      attemptHybridExecution: jest.fn().mockResolvedValue(null)
    };
    
    service = new AssistantConversationService(
      mockIntentInterpreter, // 1
      createMockAssistantConfirmationPolicy(), // 2
      createMockSceneExecutionService(), // 3
      mockDispatcher, // 4
      mockDeviceRepo, // 5
      createMockRoomRepository(), // 6
      createMockSceneRepository(), // 7
      createMockAssistantSmallTalk(), // 8
      mockMemory, // 9
      createMockFollowUpResolver(), // 10
      createMockAssistantDraftService(), // 11
      createMockAutomationRuleRepository(), // 12
      createMockAssistantLearningService(), // 13
      createMockSmartEntityResolver(), // 14
      createMockAssistantSuggestionService(), // 15
      createMockExecutionRecordRepository(), // 16
      mockShadowService // 17 (shadow service)
    );
  });

  it('executes via fast path and saves memory, allowing pronoun follow-up', async () => {
    // 1. Setup mock devices
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(testDevice);

    mockDispatcher.dispatch.mockResolvedValue(undefined);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.saveShortTermMemory.mockResolvedValue(undefined);

    // 2. Execute fast path
    const response = await service.converse({ prompt: 'prende luz cocina', userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('Luz Cocina');
    
    // Check that memory was saved
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'command',
      entities: [{ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' }]
    }));
  });

  it('bypasses shadow execution when fast path handles the request', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(testDevice);

    await service.converse({ prompt: 'prende luz cocina', userId: 'u1' }, 'es');
    
    // Fast path should succeed and NOT call shadow
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
  });

  it('calls shadow execution when fast path skips the request', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    
    mockIntentInterpreter.interpret.mockResolvedValue({
      type: 'unknown',
      prompt: 'enciende luz',
      reason: 'unknown'
    });

    await service.converse({ prompt: 'enciende luz', userId: 'u1' }, 'es');
    
    // Fast path skipped, so intent runs and shadow runs
    expect(mockShadowService.runShadow).toHaveBeenCalled();
  });
});
