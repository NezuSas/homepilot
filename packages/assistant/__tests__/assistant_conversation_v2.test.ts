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
  createMockSmartEntityResolver,
  createRealSmartEntityResolver,
  createMockAssistantSuggestionService,
  createTestDevice,
  createTestRoom
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import { AssistantMemoryPort, AssistantMemoryState } from '../application/ports/AssistantMemoryPort';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';
import { Room } from '../../topology/domain/types';



describe('AssistantConversationService V2 (Memory & Context)', () => {
  let service: AssistantConversationService;
  let mockInterpreter: jest.Mocked<IntentInterpreterPort>;
  let mockConfirmationPolicy: jest.Mocked<AssistantConfirmationPolicyPort>;
  let mockSceneExecution: SceneExecutionService;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockRoomRepo: jest.Mocked<RoomRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;
  let mockSmallTalk: jest.Mocked<AssistantSmallTalkPort>;
  let mockMemory: jest.Mocked<AssistantMemoryPort>;
  let mockFollowUp: jest.Mocked<FollowUpResolverPort>;

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockExecutionRepo = createMockExecutionRecordRepository();
    mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);
    jest.spyOn(mockSceneExecution, 'execute').mockResolvedValue({
      sceneId: 'transient',
      status: 'success',
      actions: []
    });
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);
    mockSceneRepo = createMockSceneRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();
    mockConfirmationPolicy.evaluate.mockResolvedValue({
      requiresConfirmation: false,
      prompt: '',
      intentType: 'command',
      summary: ''
    });
    mockSmallTalk = createMockAssistantSmallTalk();
    mockSmallTalk.handle.mockResolvedValue({ type: 'answer', message: 'Fallback' });
    mockMemory = createMockAssistantMemory();
    mockFollowUp = createMockFollowUpResolver();

    service = new AssistantConversationService(
      mockInterpreter,
      mockConfirmationPolicy,
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      mockSmallTalk,
      mockMemory,
      mockFollowUp,
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, mockSceneRepo, createMockAutomationRuleRepository(), mockMemory, createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      mockExecutionRepo
    );
  });

  // ─── V2: Memory follow-up ────────────────────────────────────────────────

  it('should resolve "esas" using memory and return device names with correct room', async () => {
    const memoryState: AssistantMemoryState = {
      lastQueryType: 'state_devices',
      entities: [
        { id: '1', name: 'Luz Sala', type: 'light', roomId: 'r1', roomName: 'Sala' },
        { id: '2', name: 'Luz Cocina', type: 'light', roomId: 'r2', roomName: 'Cocina' }
      ],
      timestamp: new Date().toISOString()
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);
    mockFollowUp.resolve.mockReturnValue({
      resolvedPrompt: 'qué son Luz Sala, Luz Cocina',
      handled: false,
      referencesMemory: true
    });
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true }, roomId: 'r1', homeId: 'h1' }),
      createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: true }, roomId: 'r2', homeId: 'h1' })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' }),
      createTestRoom({ id: 'r2', name: 'Cocina', homeId: 'h1' })
    ]);

    const response = await service.converse({ prompt: 'y esas?', userId: 'user-1' }, 'es');

    expect(mockFollowUp.resolve).toHaveBeenCalledWith('y esas?', expect.anything(), 'es', {});
    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Sala (Sala)');
    expect(response.message).toContain('Luz Cocina (Cocina)');
  });

  it('should save execution to memory for future follow-ups', async () => {
    mockInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: '1',
      command: 'turn_on',
      prompt: 'enciende la luz'
    });
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: '1', name: 'Luz Sala', roomId: 'r1' }));
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: '1', name: 'Luz Sala', roomId: 'r1' })]);
    mockDispatcher.dispatch.mockResolvedValue(undefined);
    mockMemory.saveShortTermMemory.mockClear();

    await service.converse({ prompt: 'enciende la luz', userId: 'user-1' }, 'es');

    // Give fire-and-forget a tick to settle
    await new Promise(r => setTimeout(r, 20));

    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      lastQueryType: 'command',
      entities: [expect.objectContaining({ id: '1', name: 'Luz Sala' })]
    }));
  });

  // ─── Problem B: Room name resolution ─────────────────────────────────────

  it('should show "Luz Cocina (Cocina)" using real homeId from device, not "system"', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'room-cocina', homeId: 'home-real', lastKnownState: { on: true } })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockImplementation(async (homeId) => {
      if (homeId === 'home-real') return [createTestRoom({ id: 'room-cocina', name: 'Cocina', homeId: 'home-real' })];
      return [];
    });

    const response = await service.converse({ prompt: 'qué luces están encendidas' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Cocina (Cocina)');
    // Must NOT have used 'system' for room lookup
    expect(mockRoomRepo.findRoomsByHomeId).toHaveBeenCalledWith('home-real');
    expect(mockRoomRepo.findRoomsByHomeId).not.toHaveBeenCalledWith('system');
  });

  it('should show "Luz Sección Escritorio (Cuarto Master)" with correct homeId', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd2', name: 'Luz Sección Escritorio', type: 'light', roomId: 'room-master', homeId: 'home-real', lastKnownState: { on: true } })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockImplementation(async (homeId) => {
      if (homeId === 'home-real') return [createTestRoom({ id: 'room-master', name: 'Cuarto Master', homeId: 'home-real' })];
      return [];
    });

    const response = await service.converse({ prompt: 'qué luces están encendidas' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Sección Escritorio (Cuarto Master)');
  });

  it('should show "Sin estancia" when device roomId is null', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd3', name: 'Luz Sala', type: 'light', roomId: null, homeId: 'home-real', lastKnownState: { on: true } })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);

    const response = await service.converse({ prompt: 'qué luces están encendidas' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Sala (Sin estancia)');
  });

  it('should show "Estancia no encontrada" when roomId exists but room is not in repository', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd4', name: 'Luz Garaje', type: 'light', roomId: 'ghost-room-id', homeId: 'home-real', lastKnownState: { on: true } })
    ]);
    // Repo returns an empty list even for home-real
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);

    const response = await service.converse({ prompt: 'qué luces están encendidas' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Luz Garaje (Estancia no encontrada)');
  });

  it('follow-up "y esas de qué cuarto son" uses cached roomName from memory entities', async () => {
    // Memory already has roomName cached — no extra DB hit needed
    const memoryState: AssistantMemoryState = {
      lastQueryType: 'state_devices',
      entities: [
        { id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'room-cocina', roomName: 'Cocina' },
        { id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'room-sala', roomName: 'Sala' }
      ],
      timestamp: new Date().toISOString()
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);
    // Follow-up resolver identifies this as a memory-based room query
    mockFollowUp.resolve.mockReturnValue({
      resolvedPrompt: 'cuarto de Luz Cocina y Luz Sala',
      handled: false,
      referencesMemory: true
    });
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'room-cocina', homeId: 'h1', lastKnownState: { on: true } }),
      createTestDevice({ id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'room-sala', homeId: 'h1', lastKnownState: { on: true } })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
      createTestRoom({ id: 'room-cocina', name: 'Cocina', homeId: 'h1' }),
      createTestRoom({ id: 'room-sala', name: 'Sala', homeId: 'h1' })
    ]);

    const response = await service.converse({ prompt: 'y esas de qué cuarto son', userId: 'user-1' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Cocina');
    expect(response.message).toContain('Sala');
  });

  // ─── Problem A: Commands must NOT call SmallTalk/Ollama ──────────────────

  it('"apaga la primera" with valid memory resolves command without calling SmallTalk', async () => {
    const memoryState: AssistantMemoryState = {
      lastQueryType: 'state_devices',
      entities: [{ id: 'light-1', name: 'Luz Escritorio', type: 'light', roomId: 'r1', roomName: 'Estudio' }],
      timestamp: new Date().toISOString()
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);
    // FollowUpResolver resolves "la primera" → "apaga Luz Escritorio"
    mockFollowUp.resolve.mockReturnValue({
      resolvedPrompt: 'apaga Luz Escritorio',
      handled: false,
      referencesMemory: true
    });
    mockInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: 'light-1',
      command: 'turn_off',
      prompt: 'apaga Luz Escritorio'
    });
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'light-1', name: 'Luz Escritorio', roomId: 'r1' }));
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', name: 'Luz Escritorio', roomId: 'r1' })]);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    const response = await service.converse({ prompt: 'apaga la primera', userId: 'user-1' }, 'es');

    expect(response.type).toBe('execution');
    expect(mockSmallTalk.handle).not.toHaveBeenCalled();
  });

  it('"enciende esa" with valid memory resolves command without calling SmallTalk', async () => {
    const memoryState: AssistantMemoryState = {
      lastQueryType: 'state_devices',
      entities: [{ id: 'light-2', name: 'Luz Cocina', type: 'light', roomId: 'r2', roomName: 'Cocina' }],
      timestamp: new Date().toISOString()
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);
    mockFollowUp.resolve.mockReturnValue({
      resolvedPrompt: 'enciende Luz Cocina',
      handled: false,
      referencesMemory: true
    });
    mockInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: 'light-2',
      command: 'turn_on',
      prompt: 'enciende Luz Cocina'
    });
    mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'light-2', name: 'Luz Cocina', roomId: 'r2' }));
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-2', name: 'Luz Cocina', roomId: 'r2' })]);
    mockDispatcher.dispatch.mockResolvedValue(undefined);

    const response = await service.converse({ prompt: 'enciende esa', userId: 'user-1' }, 'es');

    expect(response.type).toBe('execution');
    expect(mockSmallTalk.handle).not.toHaveBeenCalled();
  });

  // ─── V2 Pronoun Pre-Check Routing ─────────────────────────────────────────

  describe('V2 Pronoun Pre-Check Routing', () => {
    let mockShadowService: { attemptHybridExecution: jest.Mock; runShadow: jest.Mock };
    let serviceWithV2: AssistantConversationService;
    let originalEnv: NodeJS.ProcessEnv;

    beforeAll(() => {
      originalEnv = { ...process.env };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.ASSISTANT_PLANNER_V2_EXECUTION = 'true';

      mockShadowService = {
        attemptHybridExecution: jest.fn(),
        runShadow: jest.fn().mockResolvedValue(undefined)
      };

      serviceWithV2 = new AssistantConversationService(
        mockInterpreter,
        mockConfirmationPolicy,
        mockSceneExecution,
        mockDispatcher,
        mockDeviceRepo,
        mockRoomRepo,
        mockSceneRepo,
        mockSmallTalk,
        mockMemory,
        mockFollowUp,
        createMockAssistantDraftService(),
        createMockAutomationRuleRepository(),
        createMockAssistantLearningService(),
        createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, mockSceneRepo, createMockAutomationRuleRepository(), mockMemory, createMockAssistantLearningService()),
        createMockAssistantSuggestionService(),
        mockExecutionRepo,
        mockShadowService as any
      );
    });

    it('pronoun prompt tries V2 before V1 when execution flag is true', async () => {
      mockShadowService.attemptHybridExecution.mockResolvedValue({
        deviceId: 'dev-sala',
        command: 'turn_on',
        confidence: 0.92,
        contextSource: 'short_term_memory'
      });
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'dev-sala', name: 'Luz Sala', roomId: 'r1' })
      );
      mockDispatcher.dispatch.mockResolvedValue(undefined);
      mockMemory.saveShortTermMemory.mockResolvedValue(undefined);

      const response = await serviceWithV2.converse({ prompt: 'enciéndela', userId: 'u1' }, 'es');

      expect(mockShadowService.attemptHybridExecution).toHaveBeenCalledWith('enciéndela', 'u1');
      expect(response.type).toBe('execution');
    });

    it('if V2 approves pronoun, V1 pronoun resolver is NOT used', async () => {
      mockShadowService.attemptHybridExecution.mockResolvedValue({
        deviceId: 'dev-sala',
        command: 'turn_on',
        confidence: 0.92,
        contextSource: 'short_term_memory'
      });
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'dev-sala', name: 'Luz Sala', roomId: 'r1' })
      );
      mockDispatcher.dispatch.mockResolvedValue(undefined);
      mockMemory.saveShortTermMemory.mockResolvedValue(undefined);

      await serviceWithV2.converse({ prompt: 'enciéndela', userId: 'u1' }, 'es');

      // V1 pronoun resolver calls getShortTermMemory only during V1 path
      // V2 approved means no V1 resolution needed, so interpret should NOT be called
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
    });

    it('if V2 rejects pronoun, V1 pronoun resolver still handles it', async () => {
      mockShadowService.attemptHybridExecution.mockResolvedValue(null);
      // V1 memory with single entity so resolvePronounIntent handles it
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'command',
        entities: [{ id: 'dev-sala', name: 'Luz Sala', type: 'light', roomId: 'r1' }],
        timestamp: new Date().toISOString()
      });
      mockInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: 'dev-sala',
        command: 'turn_on',
        prompt: 'enciende Luz Sala'
      });
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'dev-sala', name: 'Luz Sala', roomId: 'r1' })
      );
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'dev-sala', name: 'Luz Sala', roomId: 'r1' })
      ]);
      mockDispatcher.dispatch.mockResolvedValue(undefined);

      const response = await serviceWithV2.converse({ prompt: 'enciéndela', userId: 'u1' }, 'es');

      expect(mockShadowService.attemptHybridExecution).toHaveBeenCalled();
      // V1 path ran — execution happened via V1 interpreter
      expect(response.type).toBe('execution');
    });

    it('non-pronoun prompt bypasses V2 pronoun pre-check entirely', async () => {
      process.env.ASSISTANT_PLANNER_V2_EXECUTION = 'true';
      // V2 should not be called for non-pronoun prompts at this gate
      mockShadowService.attemptHybridExecution.mockResolvedValue(null);
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });

      await serviceWithV2.converse({ prompt: 'enciende la luz de la cocina', userId: 'u1' }, 'es');

      // The main C.0 gate runs but the pronoun pre-check guard must NOT have fired for this prompt.
      // Verify that attemptHybridExecution was called only ONCE (from C.0 gate, not the pronoun pre-check).
      expect(mockShadowService.attemptHybridExecution).toHaveBeenCalledTimes(1);
    });

    it('V2 pronoun pre-check does NOT call shadow service when execution flag is false', async () => {
      process.env.ASSISTANT_PLANNER_V2_EXECUTION = 'false';
      mockMemory.getShortTermMemory.mockResolvedValue(null);
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });
      mockShadowService.attemptHybridExecution.mockResolvedValue(null);

      await serviceWithV2.converse({ prompt: 'enciéndela', userId: 'u1' }, 'es');

      // With flag=false, the pronoun pre-check skips calling the service.
      // The C.0 gate may still call it once (and returns null due to flag check inside),
      // but it must NOT be called twice (once for pronoun pre-check + once for C.0).
      expect(mockShadowService.attemptHybridExecution).toHaveBeenCalledTimes(1);
    });
  });
});
