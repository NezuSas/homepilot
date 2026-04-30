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
  createMockSceneExecutionService
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
    mockMemory.setUserPreference.mockResolvedValue(undefined);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('Encontré 1 luces en Sala. ¿Confirmas que quieres apagarlas?');
    expect(mockIntentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('detects "enciende todas las luces del cuarto master" correctly (fixes del/de issue)', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'enciende todas las luces del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('Encontré 1 luces en Cuarto Master. ¿Confirmas que quieres encenderlas?');
  });

  it('detects "turn off all lights in the kitchen" (English support)', async () => {
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

  it('tolerates accents and case in room matching', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Habitación' })];
    const devices = [createTestDevice({ id: 'l1', type: 'light', roomId: 'r1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'enciende todas las luces de la habitacion', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toBe('Encontré 1 luces en Habitación. ¿Confirmas que quieres encenderlas?');
  });

  it('filters devices by keyword as well as type', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    const devices = [
      createTestDevice({ id: 'l1', name: 'Lámpara de pie', type: 'switch', roomId: 'r1' }), // type switch but keyword match
      createTestDevice({ id: 'l2', name: 'Foco techo', type: 'dimmer', roomId: 'r1' })      // type dimmer but keyword match
    ];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.message).toContain('Encontré 2 luces');
  });

  it('returns safe message for unknown room', async () => {
    mockRoomRepo.findAll.mockResolvedValue([]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todas las luces del patio', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toBe('No encontré luces en esa estancia.');
  });

  it('returns fixed English message for unknown room', async () => {
    mockRoomRepo.findAll.mockResolvedValue([]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'turn off all lights in the garden', userId: 'u1' }, 'en');

    expect(res.message).toBe("I didn't find any lights in that room.");
  });
});
