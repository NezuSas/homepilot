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
  createMockSystemVariableService
} from './test_helpers';

describe('Assistant Room Bulk Fast-Path', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockIntentInterpreter: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockIntentInterpreter = createMockIntentInterpreterPort();

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
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
      undefined
    );
  });

  it('detects "apaga todas las luces de la sala" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('Encontré 1 luces en Sala. ¿Confirmas que quieres apagarlas?');
  });

  it('detects English "turn off all lights in the kitchen" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Kitchen' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'turn off all lights in the kitchen', userId: 'u1' }, 'en');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('I found 1 lights in Kitchen. Do you confirm you want to turn them off?');
  });

  it('resolves alias "mi cuarto" to "Cuarto Master" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi cuarto', userId: 'u1' }, 'es');

    expect(res.message).toContain('Cuarto Master');
  });

  it('resolves natural phrases like "apaga luces de mi cuarto porfa"', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de mi cuarto porfa', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('Encontré 1 luces en Cuarto Master. ¿Confirmas que quieres apagarlas?');
  });

  it('respects direct match priority over alias match', async () => {
    const rooms = [
      createTestRoom({ id: 'r1', name: 'Cuarto Invitados' }),
      createTestRoom({ id: 'r2', name: 'Cuarto Master' })
    ];
    const devices = [
      createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' }),
      createTestDevice({ id: 'l2', type: 'light', roomId: 'r2' })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    // Prompt "cuarto invitados" should match "Cuarto Invitados" exactly/fuzzy, not trigger alias for Master
    const res = await service.converse({ prompt: 'apaga todas las luces del cuarto invitados', userId: 'u1' }, 'es');

    expect(res.message).toContain('Cuarto Invitados');
  });

  it('handles alias ambiguity by reporting candidate rooms (improved UX)', async () => {
    const rooms = [
      createTestRoom({ id: 'r1', name: 'Cuarto Master' }),
      createTestRoom({ id: 'r2', name: 'Cuarto Principal' })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi cuarto', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toBe('Encontré varias estancias posibles: Cuarto Master, Cuarto Principal. ¿Cuál quieres usar?');
  });

  it('resolves English "turn off lights in my bedroom" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Master Bedroom' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'turn off lights in my bedroom', userId: 'u1' }, 'en');

    expect(res.message).toContain('Master Bedroom');
  });

  it('filters devices by keyword and type correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [
      createTestDevice({ id: 'l1', name: 'Lámpara pie', type: 'switch', roomId: 'r1' }), // Keyword match
      createTestDevice({ id: 'l2', name: 'Luz techo', type: 'light', roomId: 'r1' })     // Type match
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de la sala', userId: 'u1' }, 'es');

    expect(res.message).toContain('Encontré 2 luces');
  });
});
