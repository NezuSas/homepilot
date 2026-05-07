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
  createTestRoom,
  createMockSceneExecutionService,
  createMockSystemVariableService
} from './test_helpers';

describe('Assistant Room Selection Resolution', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockShadowService: any;
  let mockSmallTalk: any;
  let mockIntentInterpreter: any;
  let mockSceneExecutionService: any;

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockSmallTalk = createMockAssistantSmallTalk();
    mockIntentInterpreter = createMockIntentInterpreterPort();
    mockSceneExecutionService = createMockSceneExecutionService();
    
    mockShadowService = {
      attemptHybridExecution: jest.fn(),
      runShadow: jest.fn().mockResolvedValue(undefined)
    };

    service = new AssistantConversationService(
      mockIntentInterpreter,
      createMockAssistantConfirmationPolicy(),
      mockSceneExecutionService,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      createMockSceneRepository(),
      mockSmallTalk,
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
      mockShadowService
    );
  });

  it('1. "prende la luz" without context asks for room', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' }),
      createTestRoom({ id: 'r2', name: 'Cocina' })
    ]);
    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'prende la luz', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('En qué estancia quieres controlar la luz');
    expect(res.clarification?.options).toHaveLength(2);
    expect(res.clarification?.options?.[0].kind).toBe('room');
    
    // Bypasses shadow and smalltalk
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    expect(mockSmallTalk.handle).not.toHaveBeenCalled();
    expect(mockIntentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('2. selecting room with one light executes that light', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const light = createTestDevice({ id: 'l1', name: 'Luz Principal', type: 'light', roomId: 'r1' });
    
    mockRoomRepo.findRoomById.mockResolvedValue(room);
    mockDeviceRepo.findAll.mockResolvedValue([light]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(light);
    
    // Simulate previous clarification memory
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [
        { id: 'r1', label: 'Sala', kind: 'room' },
        { id: 'r2', label: 'Cocina', kind: 'room' }
      ],
      originalPrompt: 'prende la luz',
      pendingIntent: {
        type: 'command',
        deviceId: '',
        command: 'turn_on',
        prompt: 'prende la luz',
        timestamp: new Date().toISOString()
      }
    });

    const res = await service.converse({ prompt: 'Sala', userId: 'u1', selectedOptionId: 'r1' }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz Principal');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'l1',
            command: expect.objectContaining({ name: 'turn_on' })
          })
        ])
      }),
      expect.anything()
    );

    // Bypasses shadow and smalltalk
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    expect(mockSmallTalk.handle).not.toHaveBeenCalled();
    expect(mockIntentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('3. selecting room with multiple lights and unique primary (tumbado) executes it', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const light1 = createTestDevice({ id: 'l1', name: 'Luz Ambiental', type: 'light', roomId: 'r1' });
    const light2 = createTestDevice({ id: 'l2', name: 'Luz del Tumbado', type: 'light', roomId: 'r1' }); // Primary
    
    mockRoomRepo.findRoomById.mockResolvedValue(room);
    mockDeviceRepo.findAll.mockResolvedValue([light1, light2]);
    mockDeviceRepo.findDeviceById.mockImplementation(async (id: string) => id === 'l2' ? light2 : null);
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [{ id: 'r1', label: 'Sala', kind: 'room' }],
      originalPrompt: 'apaga la luz',
      pendingIntent: { type: 'command', deviceId: '', command: 'turn_off', prompt: 'apaga la luz', timestamp: new Date().toISOString() }
    });

    const res = await service.converse({ prompt: 'Sala', userId: 'u1', selectedOptionId: 'r1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 2 luces en Sala');
    expect(res.clarification?.options).toHaveLength(2);
  });

  it('4. selecting room with multiple lights and no primary asks device clarification', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const light1 = createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    const light2 = createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light', roomId: 'r1' });
    
    mockRoomRepo.findRoomById.mockResolvedValue(room);
    mockDeviceRepo.findAll.mockResolvedValue([light1, light2]);
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      clarificationOptions: [{ id: 'r1', label: 'Sala', kind: 'room' }],
      originalPrompt: 'prende la luz',
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({ prompt: 'Sala', userId: 'u1', selectedOptionId: 'r1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 2 luces en Sala');
    expect(res.clarification?.options).toHaveLength(2);
    expect(res.clarification?.options?.[0].kind).toBe('device');
    
    // Should preserve original command in memory
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingIntent: expect.objectContaining({
        command: 'turn_on'
      })
    }));
  });

  it('5. selecting device after room clarification executes with original command', async () => {
    const light1 = createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(light1);
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      clarificationOptions: [
        { id: 'l1', label: 'Luz 1', kind: 'device' },
        { id: 'l2', label: 'Luz 2', kind: 'device' }
      ],
      originalPrompt: 'apaga la luz',
      pendingIntent: {
        type: 'command',
        deviceId: '',
        command: 'turn_off',
        prompt: 'apaga la luz',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({ prompt: 'Luz 1', userId: 'u1', selectedOptionId: 'l1' }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Apagué Luz 1');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'l1',
            command: expect.objectContaining({ name: 'turn_off' })
          })
        ])
      }),
      expect.anything()
    );
    
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
  });
});
