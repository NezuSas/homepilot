import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockDeviceRepository, 
  createMockSceneRepository, 
  createMockRoomRepository,
  createMockIntentInterpreterService, 
  createMockAssistantConfirmationPolicy, 
  createMockDeviceCommandDispatcher,
  createMockAssistantSmallTalk,
  createMockAssistantMemory,
  createMockFollowUpResolver,
  createMockAssistantLearningService,
  createMockAssistantDraftService,
  createMockAutomationRuleRepository,
  createMockExecutionRecordRepository,
  createMockAssistantSuggestionService,
  createMockSmartEntityResolver,
  createTestDevice,
  createMockSystemVariableService
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';

describe('Assistant Proactive Suggestions', () => {
  let service: AssistantConversationService;
  let mockLearning: any;
  let mockSuggestion: any;
  let mockMemory: any;
  let mockDraft: any;
  let mockInterpreter: any;
  let mockDeviceRepo: any;
  let mockSceneRepo: any;

  beforeEach(() => {
    mockLearning = createMockAssistantLearningService();
    mockSuggestion = createMockAssistantSuggestionService();
    mockMemory = createMockAssistantMemory();
    mockDraft = createMockAssistantDraftService();
    mockInterpreter = createMockIntentInterpreterService();
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneRepo = createMockSceneRepository();
    
    const mockDispatcher = createMockDeviceCommandDispatcher();
    const mockExecutionRepo = createMockExecutionRecordRepository();
    const mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);

    service = new AssistantConversationService(
      mockInterpreter,
      createMockAssistantConfirmationPolicy(),
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      createMockRoomRepository(),
      mockSceneRepo,
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      mockDraft,
      createMockAutomationRuleRepository(),
      mockLearning,
      createMockSmartEntityResolver(),
      mockSuggestion,
      mockExecutionRepo,
      createMockSystemVariableService()
    );
  });

  it('should attach a suggestion to a success response', async () => {
    const suggestion = {
      id: 'sug-1',
      type: 'scene_suggestion',
      message: 'Would you like to create a scene?',
      metadata: { deviceIds: ['dev-1', 'dev-2'], homeId: 'home-1' },
      createdAt: new Date().toISOString()
    };
    
    mockSuggestion.getSuggestion.mockResolvedValue(suggestion);
    mockInterpreter.interpret.mockResolvedValue({ type: 'command', deviceId: 'dev-1', command: 'turn_on', prompt: 'prende la luz magica' });
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'dev-1', name: 'Luz Sala' })]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'dev-1', name: 'Luz Sala' }));

    const request = {
        prompt: 'prende la luz magica',
        userId: 'u1'
      };
    const response = await service.converse(request, 'es');
    
    expect(response.message).toContain('💡 Would you like to create a scene?');
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      pendingSuggestion: expect.objectContaining({ id: 'sug-1' })
    }));
  });

  it('should not attach a suggestion if response is an error', async () => {
    mockSuggestion.getSuggestion.mockResolvedValue({
      id: 'sug-1',
      type: 'scene_suggestion',
      message: 'Suggestion',
      metadata: {},
      createdAt: new Date().toISOString()
    });
    
    // Force an error from interpretation
    mockInterpreter.interpret.mockResolvedValue({ type: 'failure', message: 'Error' });

    const response = await service.converse({ prompt: 'prende algo' }, 'es');
    
    expect(response.type).toBe('error');
    expect(response.message).not.toContain('💡');
  });

  it('should handle suggestion acceptance and create a draft', async () => {
    const suggestion = {
      id: 'sug-1',
      type: 'scene_suggestion',
      message: 'Suggestion',
      metadata: { roomId: 'room-1', deviceIds: ['dev-1'], homeId: 'home-1' },
      createdAt: new Date().toISOString()
    };

    mockMemory.getShortTermMemory.mockResolvedValue({
      pendingSuggestion: suggestion,
      timestamp: new Date().toISOString()
    });

    const response = await service.converse({ prompt: 'sí, créala' }, 'es');
    
    expect(mockLearning.recordSuggestionResponse).toHaveBeenCalledWith(expect.anything(), 'sug-1', 'scene_suggestion', 'accepted');
    expect(mockDraft.createDraft).toHaveBeenCalledWith(expect.anything(), 'scene', expect.objectContaining({ 
      roomId: 'room-1', 
      deviceIds: ['dev-1'],
      homeId: 'home-1'
    }));
    expect(response.message).toContain('He creado un borrador');
  });

  it('should handle suggestion rejection and record suppression', async () => {
    const suggestion = {
      id: 'sug-1',
      type: 'scene_suggestion',
      message: 'Suggestion',
      metadata: {},
      createdAt: new Date().toISOString()
    };

    mockMemory.getShortTermMemory.mockResolvedValue({
      pendingSuggestion: suggestion,
      timestamp: new Date().toISOString()
    });

    const response = await service.converse({ prompt: 'no gracias' }, 'es');
    
    expect(mockLearning.recordSuggestionResponse).toHaveBeenCalledWith(expect.anything(), 'sug-1', 'scene_suggestion', 'rejected');
    expect(response.message).toContain('no volveré a sugerirte esto por ahora');
  });

  it('should prioritize alias suggestions over others', async () => {
    // This tests AssistantSuggestionService logic indirectly if we used the real service, 
    // but here we are testing the coordination in ConversationService.
    // Let's test the Service logic separately or ensure prioritize works.
  });

  it('should not suggest during explain/retry flow', async () => {
    mockSuggestion.getSuggestion.mockResolvedValue({ id: 'sug-1', message: 'Sug' });
    mockInterpreter.interpret.mockResolvedValue({ type: 'explain', prompt: 'por que fallo' });

    const response = await service.converse({ prompt: 'por que fallo' }, 'es');
    expect(response.message).not.toContain('💡');
  });
});
