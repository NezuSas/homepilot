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
  createMockSceneExecutionService,
  createMockSystemVariableService,
  createFakeConfirmationTicketRepository
} from './test_helpers';

describe('Assistant Multi-Target Confirmation Guard', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockDeviceRepo: any;
  let mockShadowService: any;
  let mockSceneExecutionService: any;
  let mockHomeRepository: any;
  let mockConfirmationTicketRepository: any;

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneExecutionService = createMockSceneExecutionService();
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    mockHomeRepository = { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'h1' }]) };
    mockConfirmationTicketRepository = createFakeConfirmationTicketRepository();

    mockShadowService = {
      attemptHybridExecution: jest.fn(),
      runShadow: jest.fn().mockResolvedValue(undefined)
    };

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      mockSceneExecutionService,
      mockDispatcher,
      mockDeviceRepo,
      createMockRoomRepository(),
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

  it('executes an infinitive bulk shortcut directly', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', homeId: 'h1', type: 'light', lastKnownState: { on: true } })
    ]);

    const res = await service.converse({ prompt: 'Apagar todo', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
  });
  it('understands a conversational whole-house command, skips only lights confirmed already off, and includes unknown-state lights', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'on-light', name: 'Luz Sala', homeId: 'h1', type: 'light', lastKnownState: { on: true } }),
      createTestDevice({ id: 'off-light', name: 'Luz Cocina', homeId: 'h1', type: 'light', lastKnownState: { on: false } }),
      createTestDevice({ id: 'unknown-light', name: 'Luz Patio', homeId: 'h1', type: 'light', lastKnownState: null })
    ]);

    const res = await service.converse({ prompt: '¿Podrías apagar todas las luces de toda la casa, por favor?', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(2);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();

    expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
  });
  it('understands an invoked elliptical whole-house shutdown without waiting for the model', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'on-light', name: 'Luz Sala', homeId: 'h1', type: 'light', lastKnownState: { on: true } }),
      createTestDevice({ id: 'off-light', name: 'Luz Cocina', homeId: 'h1', type: 'light', lastKnownState: { on: false } })
    ]);

    const res = await service.converse({ prompt: 'HomePilot, apagado todo', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();

    expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
  });
  it('asks for clarification when multiple devices remain ambiguous', async () => {
    mockShadowService.attemptHybridExecution.mockResolvedValue({
      command: 'turn_on',
      confidence: 0.9,
      resolvedType: 'multiple',
      resolvedIds: ['d1', 'd2', 'd3']
    });

    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'prende las luces', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('En qué estancia quieres controlar la luz');
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingIntent: expect.objectContaining({
        type: 'command',
        command: 'turn_on'
      })
    }));
  });

  it('executes a same-command multi-action semantic plan directly', async () => {
    const devices = [
      createTestDevice({ id: 'd1', name: 'Ventilador Pasillo', homeId: 'h1', type: 'switch', lastKnownState: { on: false } }),
      createTestDevice({ id: 'd2', name: 'Persiana Estudio', homeId: 'h1', type: 'switch', lastKnownState: { on: false } })
    ];
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id) || null));
    mockShadowService.attemptHybridExecution.mockResolvedValue({
      command: 'turn_on',
      confidence: 0.9,
      resolvedType: 'multiple',
      resolvedIds: ['d1', 'd2']
    });
    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'ejecuta la rutina combinada dos', userId: 'u1' }, 'es');

    // Guard: this prompt must actually reach the semantic path, not be intercepted
    // by an earlier deterministic fast path — otherwise this test would silently
    // exercise the wrong code path (see the sibling tests above for that pitfall).
    expect(mockShadowService.attemptHybridExecution).toHaveBeenCalled();
    expect(res.type).toBe('execution');
    expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(2);

  });

  it('triggers confirmation when a category is resolved', async () => {
    mockShadowService.attemptHybridExecution.mockResolvedValue({
      command: 'turn_off',
      confidence: 0.9,
      resolvedType: 'category',
      resolvedIds: ['d1']
    });

    mockMemory.getShortTermMemory.mockResolvedValue(null);

    const res = await service.converse({ prompt: 'apaga luces', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('En qué estancia quieres controlar la luz');
  });

  it('executes all devices when confirmed with "sí"', async () => {
    const devices = [
      createTestDevice({ id: 'd1', name: 'Luz 1', homeId: 'h1', type: 'light', lastKnownState: { on: false } }),
      createTestDevice({ id: 'd2', name: 'Luz 2', homeId: 'h1', type: 'light', lastKnownState: { on: false } })
    ];
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });

    await mockConfirmationTicketRepository.create({
      id: 'ticket-1', userId: 'u1', homeId: 'h1', command: 'turn_on',
      deviceIds: ['d1', 'd2'], originalPrompt: 'prende las luces',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(2);
    // SHADOW CHECK: verify runShadow was NOT called (it's skipped for bulk actions)
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();

    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'command',
      entities: expect.arrayContaining([
        expect.objectContaining({ id: 'd1' }),
        expect.objectContaining({ id: 'd2' })
      ])
    }));
  });

  it('rejects a confirmed bulk command outside the authenticated user home', async () => {
    const device = createTestDevice({ id: 'd1', name: 'Luz privada', homeId: 'h1', type: 'light', lastKnownState: { on: false } });
    mockDeviceRepo.findAll.mockResolvedValue([device]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(device);

    await mockConfirmationTicketRepository.create({
      id: 'ticket-2', userId: 'u1', homeId: 'h1', command: 'turn_on',
      deviceIds: ['d1'], originalPrompt: 'prende las luces',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });

    // Access to h1 was revoked between the proposal and the confirmation.
    mockHomeRepository.findHomesByUserId.mockResolvedValue([]);

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.type).toBe('error');
    expect(res.message).toContain('autorización');
    expect(mockSceneExecutionService.execute).not.toHaveBeenCalled();
    // The ticket must be consumed even on a rejected revalidation, so it can't be retried.
    expect(await mockConfirmationTicketRepository.findActiveByUserId('u1')).toBeNull();
  });
  it('discards pending action and clears memory when cancelled with "no"', async () => {
    await mockConfirmationTicketRepository.create({
      id: 'ticket-3', userId: 'u1', homeId: 'h1', command: 'turn_on',
      deviceIds: ['d1'], originalPrompt: 'prende las luces',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });

    const res = await service.converse({ prompt: 'no', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Acción cancelada');
    // The ticket is consumed on rejection too, so it can never be replayed.
    expect(await mockConfirmationTicketRepository.findActiveByUserId('u1')).toBeNull();
    // SHADOW CHECK: verify runShadow was NOT called
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
  });

  it('rejects invalid bulk command and clears memory', async () => {
    await mockConfirmationTicketRepository.create({
      id: 'ticket-4', userId: 'u1', homeId: 'h1', command: 'invalid_cmd',
      deviceIds: ['d1'], originalPrompt: 'do something',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.type).toBe('error');
    expect(res.message).toContain('inválido');
  });

  it('a confirmation cannot be replayed after it was already consumed', async () => {
    const devices = [createTestDevice({ id: 'd1', name: 'Luz 1', homeId: 'h1', type: 'light', lastKnownState: { on: false } })];
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockDeviceRepo.findDeviceById.mockResolvedValue(devices[0]);
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });

    await mockConfirmationTicketRepository.create({
      id: 'ticket-5', userId: 'u1', homeId: 'h1', command: 'turn_on',
      deviceIds: ['d1'], originalPrompt: 'prende las luces',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });

    const first = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');
    expect(first.type).toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);

    // A second "sí" has nothing to confirm any more — no active ticket remains.
    const second = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');
    expect(second.type).not.toBe('execution');
    expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
  });

  describe('Bulk Fast-Path (Deterministic)', () => {
    it('executes directly for "enciende todas las luces" without calling shadow', async () => {
      const lights = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light' }),
        createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light' })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(lights);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('execution');
      expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
      expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(2);
      expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    });

    it('executes directly for "apaga todas las luces" without calling shadow', async () => {
      const lights = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light', lastKnownState: { on: true } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(lights);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'apaga todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('execution');
      expect(mockShadowService.attemptHybridExecution).not.toHaveBeenCalled();
      expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
      expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    });

    it('returns safe answer if no lights are found', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('answer');
      expect(res.message).toContain('No encontré luces');
    });

    it('excludes unavailable devices from bulk resolution', async () => {
      const devices = [
        createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light' }),
        createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light', lastKnownState: { state: 'unavailable' } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockMemory.getShortTermMemory.mockResolvedValue(null);

      const res = await service.converse({ prompt: 'enciende todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('execution');
      expect(mockSceneExecutionService.execute).toHaveBeenCalledTimes(1);
      expect(mockConfirmationTicketRepository.create).not.toHaveBeenCalled();
    });
  });
});
