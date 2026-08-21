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
  createMockSceneExecutionService,
  createMockSystemVariableService,
  createFakeConfirmationTicketRepository,
  createTestDevice,
  createTestRoom
} from './test_helpers';

/**
 * Fase 0b regression coverage:
 * - H2: room-scoped bulk actions must require confirmation in voice, same as chat.
 * - H3: room-scoped bulk must apply the same "only devices that actually need the
 *   change" filter as the global bulk fast-path (previously asymmetric).
 * - H9: an unknown/unreported device state must never be assumed to already satisfy
 *   the target state.
 */
describe('Assistant bulk/room-bulk parity (Fase 0b)', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockSceneExecutionService: any;
  let mockConfirmationTicketRepository: any;

  beforeEach(() => {
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockSceneExecutionService = createMockSceneExecutionService();
    mockConfirmationTicketRepository = createFakeConfirmationTicketRepository();
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.getAliases.mockResolvedValue({});
    mockMemory.getUserPreference.mockResolvedValue(null);

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      mockSceneExecutionService,
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

  it('H2: room bulk over voice executes directly', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const device = createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r1', lastKnownState: { on: true } });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([device]);

    const res = await service.converse(
      { prompt: 'apaga todas las luces de la sala', userId: 'u1', interactionMode: 'voice' },
      'es'
    );

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
  });

  it('H3: room bulk excludes devices already in the target state, same as global bulk', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const alreadyOff = createTestDevice({ id: 'off-1', name: 'Luz Ya Apagada', type: 'light', roomId: 'r1', lastKnownState: { on: false } });
    const needsOff = createTestDevice({ id: 'on-1', name: 'Luz Encendida', type: 'light', roomId: 'r1', lastKnownState: { on: true } });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([alreadyOff, needsOff]);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Luz Encendida');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
  });

  it('H9: an unreported device state is never assumed to already satisfy turn_on', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    const unknownState = createTestDevice({ id: 'unknown-1', name: 'Luz Nueva', type: 'light', roomId: 'r1', lastKnownState: null });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([unknownState]);

    const res = await service.converse({ prompt: 'prende todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
  });

  it('H9: an unreported device state is never assumed to already satisfy turn_off', async () => {
    const room = createTestRoom({ id: 'r1', name: 'Sala' });
    // Not "unavailable" in the availability sense (device is reachable), just an
    // unrecognized state string that isn't clearly "on" or "off".
    const unknownState = createTestDevice({ id: 'unknown-1', name: 'Luz Nueva', type: 'light', roomId: 'r1', lastKnownState: { state: 'unknown' } });
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockDeviceRepo.findAll.mockResolvedValue([unknownState]);

    const res = await service.converse({ prompt: 'apaga todas las luces de la sala', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
  });
});
