import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockIntentInterpreterService,
  createMockAssistantConfirmationPolicy,
  createMockSceneExecutionService,
  createMockDeviceCommandDispatcher,
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAssistantSmallTalk,
  createMockAssistantMemory,
  createMockFollowUpResolver,
  createMockAssistantLearningService,
  createMockAssistantDraftService,
  createMockAutomationRuleRepository,
  createRealSmartEntityResolver,
  createMockAssistantSuggestionService,
  createMockExecutionRecordRepository,
  createTestDevice,
  createTestRoom
} from './test_helpers';

describe('Assistant Intelligence Layer V1', () => {
  let service: AssistantConversationService;
  let intentInterpreter: any;
  let memory: any;
  let deviceRepo: any;
  let roomRepo: any;
  let sceneExecutionService: any;
  let learningService: any;

  beforeEach(() => {
    intentInterpreter = createMockIntentInterpreterService();
    memory = createMockAssistantMemory();
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    sceneExecutionService = createMockSceneExecutionService();
    learningService = createMockAssistantLearningService();

    service = new AssistantConversationService(
      intentInterpreter,
      createMockAssistantConfirmationPolicy(),
      sceneExecutionService,
      createMockDeviceCommandDispatcher(),
      deviceRepo,
      roomRepo,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      memory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      learningService,
      createRealSmartEntityResolver(deviceRepo, roomRepo, createMockSceneRepository(), createMockAutomationRuleRepository(), memory, learningService),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository()
    );
  });

  describe('Contextual Pronoun Resolution', () => {
    it('should resolve "apágala" when there is exactly one recent device in memory', async () => {
      const userId = 'u1';
      const device = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      deviceRepo.findDeviceById.mockResolvedValue(device);
      memory.getShortTermMemory.mockResolvedValue({
        entities: [{ id: 'd1', name: 'Luz Escritorio', type: 'light', roomId: 'r1' }],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'apágala', userId });

      expect(res.type).toBe('execution');
      expect(res.message).toBe('Apagué Luz Escritorio.');
      expect(sceneExecutionService.execute).toHaveBeenCalledWith(
        expect.objectContaining({ actions: [expect.objectContaining({ deviceId: 'd1', command: expect.objectContaining({ name: 'turn_off' }) })] }),
        expect.any(Object)
      );
    });

    it('should resolve "ahora apagala" (complex phrase)', async () => {
      const userId = 'u1';
      const device = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      deviceRepo.findDeviceById.mockResolvedValue(device);
      memory.getShortTermMemory.mockResolvedValue({
        entities: [{ id: 'd1', name: 'Luz Escritorio', type: 'light', roomId: 'r1' }],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'ahora apagala', userId });

      expect(res.type).toBe('execution');
      expect(res.message).toBe('Apagué Luz Escritorio.');
    });

    it('should resolve "apaga esa" (complex phrase)', async () => {
      const userId = 'u1';
      const device = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      deviceRepo.findDeviceById.mockResolvedValue(device);
      memory.getShortTermMemory.mockResolvedValue({
        entities: [{ id: 'd1', name: 'Luz Escritorio', type: 'light', roomId: 'r1' }],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'apaga esa', userId });

      expect(res.type).toBe('execution');
      expect(res.message).toBe('Apagué Luz Escritorio.');
    });

    it('should request clarification for "apágala" when multiple entities are in memory', async () => {
      const userId = 'u1';
      memory.getShortTermMemory.mockResolvedValue({
        entities: [
          { id: 'd1', name: 'Luz 1', type: 'light', roomId: 'r1' },
          { id: 'd2', name: 'Luz 2', type: 'light', roomId: 'r1' }
        ],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'apágala', userId });

      expect(res.type).toBe('clarification');
      expect(res.message).toContain('varias opciones');
      expect(sceneExecutionService.execute).not.toHaveBeenCalled();
    });

    it('should resolve "enciéndela" to the correct command', async () => {
      const userId = 'u1';
      const device = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      deviceRepo.findDeviceById.mockResolvedValue(device);
      memory.getShortTermMemory.mockResolvedValue({
        entities: [{ id: 'd1', name: 'Luz Escritorio', type: 'light', roomId: 'r1' }],
        timestamp: new Date().toISOString()
      });

      const res = await service.converse({ prompt: 'enciéndela', userId });

      expect(sceneExecutionService.execute).toHaveBeenCalledWith(
        expect.objectContaining({ actions: [expect.objectContaining({ deviceId: 'd1', command: expect.objectContaining({ name: 'turn_on' }) })] }),
        expect.any(Object)
      );
    });
  });

  describe('Execution Summary', () => {
    it('should return detailed summary for single command', async () => {
      const userId = 'u1';
      const device = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      deviceRepo.findDeviceById.mockResolvedValue(device);
      deviceRepo.findAll.mockResolvedValue([device]);
      roomRepo.findRoomsByHomeId.mockResolvedValue([]);
      
      intentInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: 'd1',
        command: 'turn_on',
        prompt: 'prende luz escritorio'
      });

      const res = await service.converse({ prompt: 'prende luz escritorio', userId });

      expect(res.message).toBe('Encendí Luz Escritorio.');
    });

    it('should return detailed summary for multi-command', async () => {
      const userId = 'u1';
      const d1 = createTestDevice({ id: 'd1', name: 'Luz' });
      const d2 = createTestDevice({ id: 'd2', name: 'Ventilador' });
      deviceRepo.findDeviceById.mockImplementation((id: string) => (id === 'd1' ? d1 : d2));
      deviceRepo.findAll.mockResolvedValue([d1, d2]);
      roomRepo.findRoomsByHomeId.mockResolvedValue([]);
      
      intentInterpreter.interpret.mockResolvedValue({
        type: 'multi_command',
        actions: [
          { deviceId: 'd1', command: 'turn_on' },
          { deviceId: 'd2', command: 'turn_off' }
        ],
        prompt: 'enciende luz y apaga ventilador'
      });

      const res = await service.converse({ prompt: 'enciende luz y apaga ventilador', userId });

      expect(res.message).toBe('Ejecuté 2 acciones: encendí Luz y apagué Ventilador.');
    });

    it('should handle partial failure in multi-command', async () => {
      const userId = 'u1';
      const d1 = createTestDevice({ id: 'd1', name: 'Luz' });
      const d2 = createTestDevice({ id: 'd2', name: 'Ventilador' });
      deviceRepo.findDeviceById.mockImplementation((id: string) => (id === 'd1' ? d1 : d2));
      deviceRepo.findAll.mockResolvedValue([d1, d2]);
      roomRepo.findRoomsByHomeId.mockResolvedValue([]);
      
      sceneExecutionService.execute.mockImplementation((scene: any) => {
        if (scene.actions[0].deviceId === 'd2') {
          return { status: 'failed', actions: [{ error: 'Timeout' }] };
        }
        return { status: 'success', actions: [] };
      });

      intentInterpreter.interpret.mockResolvedValue({
        type: 'multi_command',
        actions: [
          { deviceId: 'd1', command: 'turn_on' },
          { deviceId: 'd2', command: 'turn_off' }
        ],
        prompt: 'enciende luz y apaga ventilador'
      });

      const res = await service.converse({ prompt: 'enciende luz y apaga ventilador', userId });

      expect(res.message).toContain('Ejecuté 1 de 2 acciones. Falló Ventilador: Timeout.');
    });
  });

  describe('Smart Disambiguation', () => {
    it('should prioritize exact match and not show options', async () => {
      const userId = 'u1';
      const d1 = createTestDevice({ id: 'd1', name: 'Luz Escritorio' });
      const d2 = createTestDevice({ id: 'd2', name: 'Luz Sección Escritorio' });
      deviceRepo.findAll.mockResolvedValue([d1, d2]);
      deviceRepo.findDeviceById.mockResolvedValue(d1);
      roomRepo.findRoomsByHomeId.mockResolvedValue([]);

      intentInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: 'd1',
        command: 'turn_on',
        prompt: 'luz escritorio'
      });

      const res = await service.converse({ prompt: 'luz escritorio', userId });

      expect(res.type).toBe('execution');
      expect(res.message).toBe('Encendí Luz Escritorio.');
    });

    it('should limit disambiguation to top 3 ranked by usage', async () => {
      const userId = 'u1';
      const devices = [
        createTestDevice({ id: 'd1', name: 'Luz 1' }),
        createTestDevice({ id: 'd2', name: 'Luz 2' }),
        createTestDevice({ id: 'd3', name: 'Luz 3' }),
        createTestDevice({ id: 'd4', name: 'Luz 4' }),
        createTestDevice({ id: 'd5', name: 'Luz 5' }),
      ];
      deviceRepo.findAll.mockResolvedValue(devices);
      roomRepo.findRoomsByHomeId.mockResolvedValue([]);
      
      learningService.getMostUsedDevices.mockResolvedValue([
        { entityId: 'd5', count: 100 },
        { entityId: 'd3', count: 80 },
        { entityId: 'd1', count: 50 },
        { entityId: 'd2', count: 10 },
      ]);

      intentInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: 'd1', // Interpreter picked one, but disambiguation should still trigger
        command: 'turn_on',
        prompt: 'luz'
      });

      const res = await service.converse({ prompt: 'luz', userId });

      expect(res.type).toBe('clarification');
      expect(res.clarification?.options).toHaveLength(3);
      expect(res.clarification?.options[0].id).toBe('d5');
      expect(res.clarification?.options[1].id).toBe('d3');
      expect(res.clarification?.options[2].id).toBe('d1');
    });
  });
});
