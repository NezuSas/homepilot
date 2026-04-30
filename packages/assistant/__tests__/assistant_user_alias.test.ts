import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockAssistantMemory,
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAutomationRuleRepository,
  createTestDevice, 
  createTestRoom,
  createMockAssistantLearningService,
  createMockIntentInterpreterPort,
  createMockAssistantConfirmationPolicy,
  createMockSceneExecutionService,
  createMockDeviceCommandDispatcher,
  createMockAssistantSmallTalk,
  createMockFollowUpResolver,
  createMockAssistantDraftService,
  createMockSmartEntityResolver,
  createMockAssistantSuggestionService,
  createMockExecutionRecordRepository,
  createMockAssistantPlannerV2ShadowService
} from './test_helpers';

describe('Assistant User Alias', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockSceneRepo: any;
  let mockAutomationRepo: any;
  let mockLearning: any;
  let mockShadow: any;

  beforeEach(() => {
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockSceneRepo = createMockSceneRepository();
    mockAutomationRepo = createMockAutomationRuleRepository();
    mockLearning = createMockAssistantLearningService();
    mockShadow = createMockAssistantPlannerV2ShadowService();

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      createMockSceneExecutionService(),
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      mockAutomationRepo,
      mockLearning,
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      mockShadow
    );

    jest.spyOn(service as any, 'executeSingleCommand').mockResolvedValue({ status: 'success' });
  });

  it('creates a room alias successfully and skips shadow', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Cuarto Master' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'cuando diga mi oficina me refiero a Cuarto Master', userId: 'u1' }, 'es');

    expect(mockMemory.setAlias).toHaveBeenCalledWith('u1', 'mi oficina', 'r1');
    expect(res.message).toBe("Perfecto, ahora 'mi oficina' se refiere a Cuarto Master.");
    // Verify shadow was NOT called
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('resolves user alias in natural language phrase', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Cuarto Master' });
    const light = createTestDevice({ id: 'l1', name: 'Luz Techo', type: 'light', roomId: 'r1' });
    
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([light]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi oficina porfa', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Cuarto Master');
  });

  it('prioritizes the longest matching alias', async () => {
    const room1 = createTestRoom({ id: 'r1', name: 'Oficina' });
    const room2 = createTestRoom({ id: 'r2', name: 'Sótano' });
    const light1 = createTestDevice({ id: 'l1', name: 'Luz', type: 'light', roomId: 'r1' });
    const light2 = createTestDevice({ id: 'l2', name: 'Luz', type: 'light', roomId: 'r2' });
    
    mockRoomRepo.findAll.mockResolvedValue([room1, room2]);
    mockDeviceRepo.findAll.mockResolvedValue([light1, light2]);
    // 'mi oficina' is longer than 'oficina'
    mockMemory.getAliases.mockResolvedValue({ 
      'oficina': 'r2',
      'mi oficina': 'r1' 
    });
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de mi oficina', userId: 'u1' }, 'es');

    // Should resolve to r1 (Oficina) because 'mi oficina' is a longer match than 'oficina'
    expect(res.message).toContain('Oficina');
    expect(res.message).not.toContain('Sótano');
  });

  it('returns ambiguity if multiple aliases of same length match', async () => {
    const room1 = createTestRoom({ id: 'r1', name: 'Oficina A' });
    const room2 = createTestRoom({ id: 'r2', name: 'Oficina B' });
    
    mockRoomRepo.findAll.mockResolvedValue([room1, room2]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({ 
      'mi oficina': 'r1',
      'oficina mi': 'r2' 
    });
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de mi oficina mi', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Oficina A');
    expect(res.message).toContain('Oficina B');
  });

  it('ignores device aliases during room resolution', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Lámpara' });
    
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockMemory.getAliases.mockResolvedValue({ 'mi lampara': 'd1' });
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi lampara', userId: 'u1' }, 'es');

    // Should not resolve to anything because d1 is a device, not a room
    expect(res.message).toBe('No encontré luces en esa estancia.');
  });

  it('logs invalid and falls back if alias target does not exist', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r99' });
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi oficina', userId: 'u1' }, 'es');

    expect(res.message).toBe('No encontré luces en esa estancia.');
  });
});
