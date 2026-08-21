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
  createFakeConfirmationTicketRepository
} from './test_helpers';

describe('Assistant Room Bulk Fast-Path', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockIntentInterpreter: any;
  let mockConfirmationTicketRepository: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockIntentInterpreter = createMockIntentInterpreterPort();
    mockConfirmationTicketRepository = createFakeConfirmationTicketRepository();

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
      undefined,
      undefined,
      undefined,
      undefined,
      mockConfirmationTicketRepository
    );
  });

  it('detects "apaga todas las luces de la sala" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(['clarification', 'execution']).toContain(res.type);
    expect(res.message).toBe('Apagué Device.');
  });

  it('detects English "turn off all lights in the kitchen" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Kitchen' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'turn off all lights in the kitchen', userId: 'u1' }, 'en');

    expect(['clarification', 'execution']).toContain(res.type);
    expect(res.message).toBe('Turned off Device.');
  });

  it('resolves alias "mi cuarto" to "Cuarto Master" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({ 'mi cuarto': 'r1' });
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de mi cuarto', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
  });

  it('resolves natural phrases like "apaga luces de mi cuarto porfa"', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({ 'mi cuarto': 'r1' });
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de mi cuarto porfa', userId: 'u1' }, 'es');

    expect(['clarification', 'execution']).toContain(res.type);
    expect(res.message).toBe('Apagué Device.');
  });

  it('respects direct match priority over alias match', async () => {
    const rooms = [
      createTestRoom({ id: 'r1', name: 'Cuarto Invitados' }),
      createTestRoom({ id: 'r2', name: 'Cuarto Master' })
    ];
    const devices = [
      createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } }),
      createTestDevice({ id: 'l2', type: 'light', roomId: 'r2', lastKnownState: { on: true } })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    // Prompt "cuarto invitados" should match "Cuarto Invitados" exactly/fuzzy, not trigger alias for Master
    const res = await service.converse({ prompt: 'apaga todas las luces del cuarto invitados', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
  });

  it('handles alias ambiguity by reporting candidate rooms (improved UX)', async () => {
    const rooms = [
      createTestRoom({ id: 'r1', name: 'Sala' }),
      createTestRoom({ id: 'r2', name: 'Sala' })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toBe('Encontré varias estancias posibles: Sala, Sala. ¿Cuál quieres usar?');
  });

  it('resolves English "turn off lights in my bedroom" correctly', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Master Bedroom' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1', lastKnownState: { on: true } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({ 'my bedroom': 'r1' });
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'turn off lights in my bedroom', userId: 'u1' }, 'en');

    expect(res.type).toBe('execution');
  });

  it('includes automatic HA switches with explicit light names and excludes unrelated switches', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [
      createTestDevice({ id: 'l1', name: 'Lámpara pie', type: 'switch', roomId: 'r1', lastKnownState: { on: true } }),
      createTestDevice({ id: 'l2', name: 'Luz techo', type: 'light', roomId: 'r1', lastKnownState: { on: true } }),
      createTestDevice({ id: 's1', name: 'Ventilador', type: 'switch', roomId: 'r1', lastKnownState: { on: true } })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Lámpara pie y Luz techo');
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
  });

  it('includes both devices when using "todo" in the room', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [
      createTestDevice({ id: 'l1', name: 'Lámpara pie', type: 'switch', roomId: 'r1', lastKnownState: { on: true } }),
      createTestDevice({ id: 'l2', name: 'Luz techo', type: 'light', roomId: 'r1', lastKnownState: { on: true } })
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todo en la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
  });
});
