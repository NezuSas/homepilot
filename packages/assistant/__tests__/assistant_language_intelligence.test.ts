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

describe('Assistant Language Intelligence V1', () => {
  let service: AssistantConversationService;
  let mockInterpreter: ReturnType<typeof createMockIntentInterpreterService>;
  let mockSmallTalk: ReturnType<typeof createMockAssistantSmallTalk>;
  let mockMemory: ReturnType<typeof createMockAssistantMemory>;

  beforeEach(() => {
    mockInterpreter = createMockIntentInterpreterService();
    mockSmallTalk = createMockAssistantSmallTalk();
    mockMemory = createMockAssistantMemory();

    // Default: interpreter returns unknown, smalltalk returns a fallback
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });
    mockSmallTalk.handle.mockResolvedValue({ type: 'answer', message: 'Respuesta en español' });

    // Default: no stored language preference
    mockMemory.getUserPreference.mockResolvedValue(null);

    const mockDeviceRepo = createMockDeviceRepository();
    const mockRoomRepo = createMockRoomRepository();
    const mockSceneRepo = createMockSceneRepository();
    const mockAutomationRepo = createMockAutomationRuleRepository();
    const mockLearning = createMockAssistantLearningService();

    service = new AssistantConversationService(
      mockInterpreter,
      createMockAssistantConfirmationPolicy(),
      createMockSceneExecutionService(),
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

  // 1. English prompt → EN response
  it('should detect English from "turn on the light" and persist en', async () => {
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'turn on the light', reason: 'no_match' });

    await service.converse({ prompt: 'turn on the light' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'en'
    );
  });

  // 2. Spanish prompt → ES response
  it('should detect Spanish from "enciende la luz" and use ES', async () => {
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'enciende la luz', reason: 'no_match' });

    await service.converse({ prompt: 'enciende la luz' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
  });

  // 3. Language override: Spanish → English
  it('should switch to English on "habla en inglés"', async () => {
    const response = await service.converse({ prompt: 'habla en inglés' });

    expect(response.type).toBe('answer');
    expect(response.message).toContain("I'll speak in English");
    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'en'
    );
    // No interpreter call for an override command
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
  });

  // 4. Language override: English → Spanish
  it('should switch to Spanish on "switch to spanish"', async () => {
    const response = await service.converse({ prompt: 'switch to spanish' });

    expect(response.type).toBe('answer');
    expect(response.message).toContain('hablaré en español');
    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
    expect(mockInterpreter.interpret).not.toHaveBeenCalled();
  });

  // 5. Persistence: stored preference used when prompt is ambiguous
  it('should use stored "en" preference for ambiguous short prompt', async () => {
    // Stored preference: English
    mockMemory.getUserPreference.mockResolvedValue('en');
    mockSmallTalk.handle.mockResolvedValue({ type: 'answer', message: 'Hello!' });

    await service.converse({ prompt: 'ok' });

    // Language resolved as 'en' (ambiguous prompt defaults to stored pref via _langHint hint 'en')
    // setUserPreference should be called (even if same value)
    expect(mockMemory.getUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language'
    );
  });

  // 6. Fallback: ambiguous prompt → default 'es'
  it('should fall back to ES for a completely ambiguous prompt with no stored preference', async () => {
    mockMemory.getUserPreference.mockResolvedValue(null);
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'ok', reason: 'no_match' });

    await service.converse({ prompt: 'ok' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
  });

  // 7. Accented Spanish always detected as ES even when English hint is passed
  it('should detect Spanish accent and override API hint', async () => {
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'qué tal', reason: 'no_match' });

    // _langHint is 'en' but the prompt has an accent → ES wins
    await service.converse({ prompt: 'qué tal' }, 'en');

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
  });

  // 8. Unaccented Spanish detection overrides English stored preference
  it('should detect Spanish from "que es nezu" even if preference is English', async () => {
    mockMemory.getUserPreference.mockResolvedValue('en');
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'que es nezu', reason: 'no_match' });

    await service.converse({ prompt: 'que es nezu' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
  });

  // 9. "gracias" detected as Spanish overrides English stored preference
  it('should detect Spanish from "gracias" even if preference is English', async () => {
    mockMemory.getUserPreference.mockResolvedValue('en');
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'gracias', reason: 'no_match' });

    await service.converse({ prompt: 'gracias' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'es'
    );
  });

  // 10. "hi" detected as English
  it('should detect English from "hi"', async () => {
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'hi', reason: 'no_match' });

    await service.converse({ prompt: 'hi' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'en'
    );
  });

  // 11. Ambiguous prompt with no signal should use stored preference
  it('should use stored preference when prompt is ambiguous', async () => {
    mockMemory.getUserPreference.mockResolvedValue('en');
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '...', reason: 'no_match' });

    await service.converse({ prompt: '...' });

    expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
      expect.anything(), 'preferred_language', 'en'
    );
  });
});
