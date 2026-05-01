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
  createTestDevice,
  createTestRoom,
  createMockSceneExecutionService,
  createMockSystemVariableService,
  createMockAssistantPlannerV2ShadowService
} from './test_helpers';

describe('Assistant Context-Aware Room Fast-Path', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockIntentInterpreter: any;
  let mockShadow: any;
  let mockFollowUp: any;
  let execMock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockIntentInterpreter = createMockIntentInterpreterPort();
    mockShadow = createMockAssistantPlannerV2ShadowService();
    mockFollowUp = createMockFollowUpResolver();

    service = new AssistantConversationService(
      mockIntentInterpreter,
      createMockAssistantConfirmationPolicy(),
      createMockSceneExecutionService(),
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      mockRoomRepo,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      mockMemory,
      mockFollowUp,
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
      mockShadow
    );

    execMock = jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success', sceneId: 's1', actions: [] });
  });

  it('1. "prende la luz" with sourceRoomId and one room light executes directly', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const execMock = jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz Sala');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'prende la luz', expect.any(String));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
    expect(mockIntentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('2. "apaga la luz" with sourceRoomId executes directly', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    
    const res = await service.converse({ prompt: 'apaga la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Apagué Luz Sala');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_off', 'apaga la luz', expect.any(String));
  });

  it('3. no sourceRoomId returns null/falls through safely', async () => {
    mockRoomRepo.findAll.mockResolvedValue([]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1' }, 'es');
    expect(res.type).not.toBe('execution'); 
  });

  it('4. explicit device name still wins over sourceRoomId', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'luz mesa', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const res = await service.converse({ prompt: 'prende luz mesa', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    // Should be resolved by V1 Fast Path, NOT context room (though result is similar, V1 wins by pipeline order)
    expect(res.type).toBe('execution');
    expect(res.message).toContain('encendí luz mesa');
  });

  it('5. explicit room bulk still wins over sourceRoomId', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('clarification'); 
    expect(res.message).toContain('¿Confirmas que quieres apagarlas?');
  });

  it('6. multiple lights with one "principal/main/techo/ceiling" picks primary', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const d1 = createTestDevice({ id: 'd1', name: 'Luz Secundaria', type: 'light', roomId: 'r1' });
    const d2 = createTestDevice({ id: 'd2', name: 'Luz Principal', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([d1, d2]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const execMock = jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz Principal');
    expect(execMock).toHaveBeenCalledWith('d2', 'turn_on', 'prende la luz', expect.any(String));
  });

  it('7. multiple lights without unique primary asks clarification and saves memory', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const d1 = createTestDevice({ id: 'd1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    const d2 = createTestDevice({ id: 'd2', name: 'Luz 2', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([d1, d2]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    const execMockLocal = jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand');
    
    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré varias luces');
    expect(execMockLocal).not.toHaveBeenCalled();
    
    // Verify memory persistence for follow-up (Option A: no pendingIntent)
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'clarification',
      originalPrompt: 'prende la luz',
      source: 'context_room'
    }));
    
    // Verify pendingAction is returned for click execution
    expect(res.clarification).toBeDefined();
    expect(res.clarification?.pendingAction).toEqual({
      command: 'turn_on',
      originalPrompt: 'prende la luz'
    });
  });

  it('8. unavailable lights are ignored', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    // d1 is unavailable
    const d1 = createTestDevice({ 
      id: 'd1', 
      name: 'Luz 1', 
      type: 'light', 
      roomId: 'r1', 
      lastKnownState: { state: 'unavailable' }
    });
    // d2 is available (even if status is not ASSIGNED, as long as it's not explicitly unavailable)
    const d2 = createTestDevice({ 
      id: 'd2', 
      name: 'Luz 2', 
      type: 'light', 
      roomId: 'r1', 
      status: 'PENDING'
    });
    
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([d1, d2]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz 2');
    expect(execMock).toHaveBeenCalledWith('d2', 'turn_on', 'prende la luz', expect.any(String));
  });

  it('9. saves memory for pronoun follow-up', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'command',
      entities: [{ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' }]
    }));
  });

  it('10. does not call shadowService.runShadow', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('11. does not call intentInterpreter.interpret on successful context execution', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);
    
    jest.spyOn(service as unknown as Record<string, any>, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
    
    await service.converse({ prompt: 'prende la luz', userId: 'u1', sourceRoomId: 'r1' }, 'es');
    
    expect(mockIntentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('12. "la primera" after context clarification executes correctly', async () => {
    const d1 = createTestDevice({ id: 'd1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    const d2 = createTestDevice({ id: 'd2', name: 'Luz 2', type: 'light', roomId: 'r1' });
    
    // Simulate memory after a clarification was issued (Option A: only originalPrompt)
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      clarificationOptions: [
        { id: 'd1', label: 'Luz 1', kind: 'device' },
        { id: 'd2', label: 'Luz 2', kind: 'device' }
      ],
      originalPrompt: 'prende la luz',
      source: 'context_room',
      timestamp: new Date().toISOString()
    });
    
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(id === 'd1' ? d1 : d2));
    
    const res = await service.converse({ prompt: 'la primera', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz 1');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'prende la luz', expect.any(String));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('12.5 clicking an option with pendingAction executes directly and bypasses shadow', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const d1 = createTestDevice({ id: 'd1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(d1);
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      source: 'context_room',
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({
      prompt: 'Selected: Luz 1',
      userId: 'u1',
      selectedOptionId: 'd1',
      pendingAction: {
        command: 'turn_on',
        originalPrompt: 'prende la luz'
      }
    }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz 1');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'prende la luz', expect.any(String));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
    // Verify log source
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ASSISTANT_SELECTION_EXECUTED]'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"source":"ui_option"'));
    consoleSpy.mockRestore();
  });

  it('12.6 clicking an option without pendingAction but memory source context_room reconstructs command', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const d1 = createTestDevice({ id: 'd1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(d1);
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      source: 'context_room',
      originalPrompt: 'prende la luz',
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({
      prompt: 'Selected: Luz 1',
      userId: 'u1',
      selectedOptionId: 'd1'
      // pendingAction is missing
    }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz 1');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'prende la luz', expect.any(String));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"source":"ui_option"'));
    consoleSpy.mockRestore();
  });

  it('12.7 typing candidate name after context clarification executes directly and bypasses shadow', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const d1 = createTestDevice({ id: 'd1', name: 'Luz Mesa', type: 'light', roomId: 'r1' });
    const d2 = createTestDevice({ id: 'd2', name: 'Luz Techo', type: 'light', roomId: 'r1' });
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      clarificationOptions: [
        { id: 'd1', label: 'Luz Mesa', kind: 'device' },
        { id: 'd2', label: 'Luz Techo', kind: 'device' }
      ],
      originalPrompt: 'prende la luz',
      source: 'context_room',
      timestamp: new Date().toISOString()
    });
    
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(id === 'd1' ? d1 : d2));
    
    const res = await service.converse({ prompt: 'luz mesa', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz Mesa');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'prende la luz', expect.any(String));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"source":"text_selection"'));
    consoleSpy.mockRestore();
  });

  it('13. "turn off the light" with sourceRoomId executes directly in English', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Living Room' });
    const device = createTestDevice({ id: 'd1', name: 'Ceiling Light', type: 'light', roomId: 'r1' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue('en');
    
    const res = await service.converse({ prompt: 'turn off the light', userId: 'u1', sourceRoomId: 'r1' }, 'en');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Turned off Ceiling Light');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_off', 'turn off the light', expect.any(String));
  });

  it('14. "the first one" after English context clarification executes correctly', async () => {
    const d1 = createTestDevice({ id: 'd1', name: 'Lamp 1', type: 'light', roomId: 'r1' });
    const d2 = createTestDevice({ id: 'd2', name: 'Lamp 2', type: 'light', roomId: 'r1' });
    
    // Simulate memory after an English clarification
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      clarificationOptions: [
        { id: 'd1', label: 'Lamp 1', kind: 'device' },
        { id: 'd2', label: 'Lamp 2', kind: 'device' }
      ],
      originalPrompt: 'turn on the light',
      timestamp: new Date().toISOString()
    });
    
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue('en');
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(id === 'd1' ? d1 : d2));
    
    const res = await service.converse({ prompt: 'the first', userId: 'u1' }, 'en');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Turned on Lamp 1');
    expect(execMock).toHaveBeenCalledWith('d1', 'turn_on', 'turn on the light', expect.any(String));
  });
});
