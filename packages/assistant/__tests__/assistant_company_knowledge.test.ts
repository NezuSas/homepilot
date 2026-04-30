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
  createMockSceneExecutionService,
  createRealSmartEntityResolver,
  createMockSystemVariableService
} from './test_helpers';

describe('Assistant Company Knowledge', () => {
  let service: AssistantConversationService;
  let mockInterpreter: ReturnType<typeof createMockIntentInterpreterService>;
  let mockSmallTalk: ReturnType<typeof createMockAssistantSmallTalk>;
  let mockSceneExecution: ReturnType<typeof createMockSceneExecutionService>;

  beforeEach(() => {
    mockInterpreter = createMockIntentInterpreterService();
    mockSmallTalk = createMockAssistantSmallTalk();
    mockSceneExecution = createMockSceneExecutionService();
    const mockDeviceRepo = createMockDeviceRepository();
    const mockRoomRepo = createMockRoomRepository();
    const mockSceneRepo = createMockSceneRepository();
    const mockMemory = createMockAssistantMemory();
    const mockAutomationRepo = createMockAutomationRuleRepository();
    const mockLearning = createMockAssistantLearningService();

    service = new AssistantConversationService(
      mockInterpreter,
      createMockAssistantConfirmationPolicy(),
      mockSceneExecution,
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      mockSmallTalk,
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      mockAutomationRepo,
      mockLearning,
      createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, mockSceneRepo, mockAutomationRepo, mockMemory, mockLearning),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService()
    );
  });

  it('should respond with NEZU info for "qué es nezu"', async () => {
    const response = await service.converse({ prompt: 'qué es nezu' }, 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('NEZU S.A.S.');
    expect(response.message).toContain('https://www.nezuecuador.com/');
    // Verify no LLM/Smalltalk call
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
    expect(mockSmallTalk.handle).not.toHaveBeenCalled();
  });

  it('should respond with NEZU info for "who created homepilot" (EN)', async () => {
    const response = await service.converse({ prompt: 'who created homepilot' }, 'en');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('NEZU S.A.S.');
    expect(response.message).toContain('Ecuadorian technology company');
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('should respond with NEZU info for "nezu sas"', async () => {
    const response = await service.converse({ prompt: 'nezu sas' }, 'es');
    expect(response.message).toContain('NEZU S.A.S.');
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('should respond with NEZU info for "qué servicios ofrece nezu"', async () => {
    const response = await service.converse({ prompt: 'qué servicios ofrece nezu' }, 'es');
    expect(response.message).toContain('servicios de automatización, seguridad e infraestructura');
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
  });
});
