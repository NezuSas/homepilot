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
  createMockHomeRepository,
  createFakeConfirmationTicketRepository,
  createTestDevice,
  createTestRoom,
  createTestHome
} from './test_helpers';

/**
 * Fase 0 (aislamiento por hogar): un usuario nunca debe ver, contar ni ejecutar
 * comandos sobre dispositivos, estancias o escenas de un hogar que no le pertenece.
 * Estas pruebas configuran findAllByHomeId/findRoomsByHomeId directamente (sin
 * delegar a findAll) para verificar que el filtrado por hogar realmente ocurre,
 * no que el fallback legado siga funcionando.
 */
describe('Assistant home isolation (Fase 0)', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockHomeRepository: any;
  let mockShadowService: any;
  let mockConfirmationTicketRepository: any;

  const homeA = createTestHome({ id: 'home-a', ownerId: 'user-a' });
  const homeB = createTestHome({ id: 'home-b', ownerId: 'user-b' });

  const deviceInHomeA = createTestDevice({ id: 'device-a1', name: 'Luz Sala', homeId: 'home-a', roomId: 'room-a1', lastKnownState: { on: true } });
  const deviceInHomeB = createTestDevice({ id: 'device-b1', name: 'Luz Sala', homeId: 'home-b', roomId: 'room-b1', lastKnownState: { on: true } });

  const roomInHomeA = createTestRoom({ id: 'room-a1', homeId: 'home-a', name: 'Sala A' });
  const roomInHomeB = createTestRoom({ id: 'room-b1', homeId: 'home-b', name: 'Sala B' });

  beforeEach(() => {
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockHomeRepository = createMockHomeRepository();
    mockConfirmationTicketRepository = createFakeConfirmationTicketRepository();
    mockShadowService = {
      attemptHybridExecution: jest.fn().mockResolvedValue(null),
      runShadow: jest.fn().mockResolvedValue(undefined)
    };

    // Only user-a is authorized for home-a. findAllByHomeId/findRoomsByHomeId are
    // configured per-home explicitly (not derived from findAll()) so a leak would
    // only be caught if the production code actually calls the scoped repository
    // methods instead of the unrestricted findAll().
    mockHomeRepository.findHomesByUserId.mockImplementation((userId: string) =>
      Promise.resolve(userId === 'user-a' ? [homeA] : userId === 'user-b' ? [homeB] : [])
    );
    mockDeviceRepo.findAllByHomeId.mockImplementation((homeId: string) =>
      Promise.resolve(homeId === 'home-a' ? [deviceInHomeA] : homeId === 'home-b' ? [deviceInHomeB] : [])
    );
    mockRoomRepo.findRoomsByHomeId.mockImplementation((homeId: string) =>
      Promise.resolve(homeId === 'home-a' ? [roomInHomeA] : homeId === 'home-b' ? [roomInHomeB] : [])
    );
    // findAll() (unscoped) intentionally returns BOTH homes' data, so any call site
    // that forgot to switch to the scoped method would leak cross-home entities.
    mockDeviceRepo.findAll.mockResolvedValue([deviceInHomeA, deviceInHomeB]);
    mockRoomRepo.findAll.mockResolvedValue([roomInHomeA, roomInHomeB]);

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
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
      mockShadowService,
      undefined,
      undefined,
      mockHomeRepository,
      mockConfirmationTicketRepository
    );

    process.env.ASSISTANT_PLANNER_V2_EXECUTION = 'true';
  });

  afterEach(() => {
    delete process.env.ASSISTANT_PLANNER_V2_EXECUTION;
  });

  it('home summary only counts devices from the caller\'s own home', async () => {
    const res = await service.converse({ prompt: 'dame un resumen de la casa', userId: 'user-a' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).not.toContain('2');
    expect(mockDeviceRepo.findAllByHomeId).toHaveBeenCalledWith('home-a');
    expect(mockDeviceRepo.findAllByHomeId).not.toHaveBeenCalledWith('home-b');
  });

  it('room list only includes rooms from the caller\'s own home', async () => {
    const res = await service.converse({ prompt: 'que estancias conoces', userId: 'user-a' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Sala A');
    expect(res.message).not.toContain('Sala B');
  });

  it('bulk "apaga todo" only resolves devices from the caller\'s own home', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga todo', userId: 'user-a' }, 'es');

    expect(['clarification', 'execution']).toContain(res.type);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    expect(mockDeviceRepo.findAllByHomeId).toHaveBeenCalledWith('home-a');
    expect(mockDeviceRepo.findAllByHomeId).not.toHaveBeenCalledWith('home-b');
  });

  it('a different authorized user never sees the other home\'s devices or rooms', async () => {
    const summary = await service.converse({ prompt: 'dame un resumen de la casa', userId: 'user-b' }, 'es');
    expect(mockDeviceRepo.findAllByHomeId).toHaveBeenCalledWith('home-b');
    expect(mockDeviceRepo.findAllByHomeId).not.toHaveBeenCalledWith('home-a');

    const rooms = await service.converse({ prompt: 'que estancias conoces', userId: 'user-b' }, 'es');
    expect(rooms.message).toContain('Sala B');
    expect(rooms.message).not.toContain('Sala A');

    expect(summary.type).toBe('answer');
  });

  it('a user with no authorized homes resolves to nothing rather than falling back to global data', async () => {
    const res = await service.converse({ prompt: 'que estancias conoces', userId: 'user-without-home' }, 'es');

    expect(res.message).not.toContain('Sala A');
    expect(res.message).not.toContain('Sala B');
  });
});
