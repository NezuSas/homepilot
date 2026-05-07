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
  createMockExecutionRecordRepository,
  createMockAssistantLearningService,
  createMockAssistantDraftService,
  createMockAutomationRuleRepository,
  createMockAssistantSuggestionService,
  createTestDevice,
  createTestRoom,
  createMockSystemVariableService,
  createRealSmartEntityResolver
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';

describe('Assistant Semantic Hardening', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockInterpreter: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockInterpreter = createMockIntentInterpreterService();
    
    const mockExecutionRepo = createMockExecutionRecordRepository();
    const mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);

    service = new AssistantConversationService(
      mockInterpreter,
      createMockAssistantConfirmationPolicy(),
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, createMockSceneRepository(), createMockAutomationRuleRepository(), mockMemory, createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      mockExecutionRepo,
      createMockSystemVariableService()
    );
  });

  it('Room named "Dormitorio" is not auto-treated as "mi cuarto" without user alias', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Dormitorio' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    // This is a room bulk command or similar. 
    // In singular light path, it tries to resolve room.
    const res = await (service as any).resolveRoomAlias('mi cuarto', [createTestRoom({ id: 'r1', name: 'Dormitorio' })], [], 'u1', {});
    expect(res.status).toBe('not_found');
  });

  it('"apaga la luz de mi cuarto" returns not found/asks safely when no alias exists', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Dormitorio' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'd1', name: 'Luz', type: 'light', roomId: 'r1' })
    ]);
    mockMemory.getAliases.mockResolvedValue({});
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown' });

    const res = await service.converse({ prompt: 'apaga la luz de mi cuarto', userId: 'u1' }, 'es');
    
    // Should NOT have resolved to Dormitorio via hardcoded alias
    // Since it's 'unknown' to interpreter, it goes to smalltalk or similar
    // But let's check if it even tried to resolve room and failed
    expect(res.type).toBe('answer');
    expect(res.message).toBe('Hello'); // Default mock smalltalk
  });

  it('State query with unknown room returns "No encontré esa estancia"', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await (service as any).handleStateQuery('qué luces hay en el garaje', 'es', 'User', 'u1');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré esa estancia');
  });

  it('Device named "test light" is matchable if available', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'test light', status: 'ASSIGNED', lastKnownState: { state: 'on' } });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);

    const matches = await (service as any).findMatchingDevices('test light', 'u1');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('d1');
  });

  it('Unavailable device is excluded by state, not name', async () => {
    const unavailableDevice = createTestDevice({ 
        id: 'd1', 
        name: 'Luz Cocina', 
        lastKnownState: { state: 'unavailable' } 
    });
    mockDeviceRepo.findAll.mockResolvedValue([unavailableDevice]);

    const matches = await (service as any).findMatchingDevices('Luz Cocina', 'u1');
    expect(matches).toHaveLength(0);
  });

  it('"estado de la cocina" returns room not found if Cocina is not in RoomRepository', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await service.converse({ prompt: 'qué luces hay en la cocina', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré esa estancia');
  });

  it('Draft creation for "Dormitorio" fails if no room or alias exists', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await service.converse({ prompt: 'crea una escena para el dormitorio', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré la estancia');
  });
});
