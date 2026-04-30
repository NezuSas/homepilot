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
  createMockSceneExecutionService,
  createMockSystemVariableService
} from './test_helpers';

describe('Fast Path Integration in AssistantConversationService', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockShadowService: any;
  let mockIntentInterpreter: any;

  beforeEach(() => {
    mockIntentInterpreter = createMockIntentInterpreterPort();
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockShadowService = { 
      runShadow: jest.fn().mockResolvedValue(undefined),
      attemptHybridExecution: jest.fn().mockResolvedValue(null)
    };
    
    service = new AssistantConversationService(
      mockIntentInterpreter, // 1
      createMockAssistantConfirmationPolicy(), // 2
      createMockSceneExecutionService(), // 3
      mockDispatcher, // 4
      mockDeviceRepo, // 5
      mockRoomRepo, // 6
      createMockSceneRepository(), // 7
      createMockAssistantSmallTalk(), // 8
      mockMemory, // 9
      createMockFollowUpResolver(), // 10
      createMockAssistantDraftService(), // 11
      createMockAutomationRuleRepository(), // 12
      createMockAssistantLearningService(), // 13
      createMockSmartEntityResolver(), // 14
      createMockAssistantSuggestionService(), // 15
      createMockExecutionRecordRepository(), // 16
      createMockSystemVariableService(), // 17 (added)
      mockShadowService // 18 (shadow service)
    );
  });

  it('executes via fast path and saves memory, allowing pronoun follow-up', async () => {
    // 1. Setup mock devices
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(testDevice);

    mockDispatcher.dispatch.mockResolvedValue(undefined);
    mockMemory.getShortTermMemory.mockResolvedValue(null);
    mockMemory.saveShortTermMemory.mockResolvedValue(undefined);

    // 2. Execute fast path
    const response = await service.converse({ prompt: 'prende luz cocina', userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('Luz Cocina');
    
    // Check that memory was saved
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastQueryType: 'command',
      entities: [{ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' }]
    }));
  });

  it('bypasses shadow execution when fast path handles the request', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(testDevice);

    await service.converse({ prompt: 'prende luz cocina', userId: 'u1' }, 'es');
    
    // Fast path should succeed and NOT call shadow
    expect(mockShadowService.runShadow).not.toHaveBeenCalled();
  });

  it('calls shadow execution when fast path skips the request', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
    
    mockIntentInterpreter.interpret.mockResolvedValue({
      type: 'unknown',
      prompt: 'enciende luz',
      reason: 'unknown'
    });

    await service.converse({ prompt: 'enciende luz', userId: 'u1' }, 'es');
    
    // Fast path skipped, so intent runs and shadow runs
    expect(mockShadowService.runShadow).toHaveBeenCalled();
  });

  describe('Deterministic Query Shadow Bypass', () => {
    it('bypasses shadow for "qué luces están encendidas" (State Query)', async () => {
      const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', lastKnownState: { on: true } });
      mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
      
      await service.converse({ prompt: 'qué luces están encendidas', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('bypasses shadow for "qué luces están apagadas" (State Query)', async () => {
      const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', lastKnownState: { on: false } });
      mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
      
      await service.converse({ prompt: 'qué luces están apagadas', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('bypasses shadow for "esta encendida la luz de la cocina?" (Point State Query)', async () => {
      const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', lastKnownState: { on: true } });
      mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
      
      await service.converse({ prompt: 'esta encendida la luz cocina', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('bypasses shadow for "que estancias conoces" (Room Query)', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);
      
      await service.converse({ prompt: 'que estancias conoces', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('calls shadow for non-deterministic home-control prompt "ayúdame con la luz"', async () => {
      const testDevice = createTestDevice({ id: 'd1', name: 'Luz Cocina' });
      mockDeviceRepo.findAll.mockResolvedValue([testDevice]);
      mockIntentInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'ayúdame con la luz' });

      await service.converse({ prompt: 'ayúdame con la luz', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).toHaveBeenCalled();
    });

    it('returns compact summary for broad query "estado de la casa" and bypasses shadow', async () => {
      const devices = [
        createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1', homeId: 'h1', lastKnownState: { on: true } }),
        createTestDevice({ id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'r2', homeId: 'h1', lastKnownState: { on: false } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        { id: 'r1', name: 'Cocina' },
        { id: 'r2', name: 'Sala' }
      ]);
      
      const res = await service.converse({ prompt: 'estado de la casa', userId: 'u1' }, 'es');
      
      expect(res.message).toContain('Estado de la casa:');
      expect(res.message).toContain('Encendidas: 1');
      expect(res.message).toContain('Apagadas: 1');
      expect(res.message).toContain('Estancias con actividad: Cocina');
      expect(res.message).toContain('dame detalle');
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('returns detailed answer for "dame detalle" after broad state query and bypasses shadow', async () => {
      const devices = [
        createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1', homeId: 'h1', lastKnownState: { on: true } }),
        createTestDevice({ id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'r2', homeId: 'h1', lastKnownState: { on: false } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        { id: 'r1', name: 'Cocina' },
        { id: 'r2', name: 'Sala' }
      ]);
      
      // Setup memory
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'state_devices',
        entities: [
          { id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1', roomName: 'Cocina' },
          { id: 'd2', name: 'Luz Sala', type: 'light', roomId: 'r2', roomName: 'Sala' }
        ],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'dame detalle', userId: 'u1' }, 'es');
      
      expect(res.message).toContain('Detalle de la casa:');
      expect(res.message).toContain('Encendidas:');
      expect(res.message).toContain('• Luz Cocina (Cocina)');
      expect(res.message).toContain('Apagadas:');
      expect(res.message).toContain('• Luz Sala (Sala)');
      expect(mockShadowService.runShadow).not.toHaveBeenCalled();
    });

    it('falls back to intent/shadow for "dame detalle" if memory is missing', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue(null);
      mockIntentInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'dame detalle' });

      await service.converse({ prompt: 'dame detalle', userId: 'u1' }, 'es');
      
      expect(mockShadowService.runShadow).toHaveBeenCalled();
    });

    it('works with English "show detail"', async () => {
      const devices = [
        createTestDevice({ id: 'd1', name: 'Kitchen Light', type: 'light', roomId: 'r1', homeId: 'h1', lastKnownState: { on: true } })
      ];
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([{ id: 'r1', name: 'Kitchen' }]);
      
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'state_devices',
        entities: [{ id: 'd1', name: 'Kitchen Light', type: 'light', roomId: 'r1', roomName: 'Kitchen' }],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'show detail', userId: 'u1' }, 'en');
      
      expect(res.message).toContain('House detail:');
      expect(res.message).toContain('On:');
      expect(res.message).toContain('• Kitchen Light (Kitchen)');
    });
  });
});
