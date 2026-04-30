import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockDeviceRepository, 
  createMockRoomRepository, 
  createMockSceneRepository, 
  createMockIntentInterpreterService, 
  createMockAssistantConfirmationPolicy, 
  createMockAssistantSmallTalk, 
  createMockAssistantMemory, 
  createMockFollowUpResolver,
  createMockAssistantLearningService,
  createMockSmartEntityResolver,
  createMockAssistantSuggestionService,
  createMockExecutionRecordRepository,
  createRealSmartEntityResolver
} from './test_helpers';
import { createTestDevice } from './test_helpers';

describe('Assistant Management V1', () => {
  let service: AssistantConversationService;
  let deviceRepo: any;
  let roomRepo: any;
  let sceneRepo: any;
  let automationRepo: any;
  let intentInterpreter: any;
  let confirmationPolicy: any;
  let sceneExecutionService: any;
  let dispatcher: any;
  let smallTalk: any;
  let memory: any;
  let followUp: any;
  let draftService: any;

  beforeEach(() => {
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    sceneRepo = createMockSceneRepository();
    automationRepo = { 
      findAll: jest.fn().mockResolvedValue([]), 
      findById: jest.fn(), 
      save: jest.fn(), 
      delete: jest.fn() 
    };
    intentInterpreter = createMockIntentInterpreterService();
    confirmationPolicy = createMockAssistantConfirmationPolicy();
    sceneExecutionService = { execute: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    smallTalk = createMockAssistantSmallTalk();
    memory = createMockAssistantMemory();
    followUp = createMockFollowUpResolver();
    draftService = { 
      createSceneDraft: jest.fn(), 
      createAutomationDraft: jest.fn(), 
      activateDraft: jest.fn() 
    };

    service = new AssistantConversationService(
      intentInterpreter,
      confirmationPolicy,
      sceneExecutionService,
      dispatcher,
      deviceRepo,
      roomRepo,
      sceneRepo,
      smallTalk,
      memory,
      followUp,
      draftService,
      automationRepo,
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(deviceRepo, roomRepo, sceneRepo, automationRepo, memory, createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository()
    );

    // Default mocks
    smallTalk.handle.mockResolvedValue({ type: 'answer', message: 'Fallback' });
    memory.getShortTermMemory.mockResolvedValue(null);
    memory.getAliases.mockResolvedValue({});
  });

  describe('A. Alias Correction', () => {
    it('should NOT create alias for generic phrases like "eres mi perra?"', async () => {
      const prompt = 'eres mi perra?';
      await service.converse({ prompt }, 'es');
      
      // Should fall through to other detectors or intent interpreter
      // If it doesn't match likely home control, it goes to smalltalk
      expect(smallTalk.handle).toHaveBeenCalled();
    });

    it('should create alias for explicit pattern "cuando diga mi cuarto me refiero a Cuarto Master"', async () => {
      const prompt = 'cuando diga mi cuarto me refiero a Cuarto Master';
      deviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'd1', name: 'Cuarto Master' })
      ]);
      
      const response = await service.converse({ prompt }, 'es');
      expect(response.type).toBe('answer');
      expect(memory.setAlias).toHaveBeenCalledWith('system', 'mi cuarto', 'd1');
    });
  });

  describe('B. Point State Query', () => {
    it('should respond with exact state for device "luz cocina encendida?"', async () => {
      const prompt = 'la luz cocina esta encendida?';
      deviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'd1', name: 'Luz Cocina', lastKnownState: { state: 'on' } })
      ]);
      
      const response = await service.converse({ prompt }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Sí, Luz Cocina está encendido');
    });

    it('should respond with room summary for "la cocina esta encendida?"', async () => {
      const prompt = 'la cocina esta encendida?';
      roomRepo.findAll.mockResolvedValue([{ id: 'r1', name: 'Cocina' }]);
      deviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'd1', name: 'Luz Cocina', lastKnownState: { state: 'on' }, roomId: 'r1', type: 'light' }),
        createTestDevice({ id: 'd2', name: 'Extractor', lastKnownState: { state: 'off' }, roomId: 'r1', type: 'switch' })
      ]);
      
      const response = await service.converse({ prompt }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Hay 1 de 2 dispositivos encendidos');
    });
  });

  describe('C/D. Listing', () => {
    it('should list scenes', async () => {
      sceneRepo.findAll.mockResolvedValue([
        { id: 's1', name: 'Modo Cine' },
        { id: 's2', name: 'Apagar Todo' }
      ]);
      const response = await service.converse({ prompt: 'lista mis escenas' }, 'es');
      expect(response.message).toContain('Modo Cine');
      expect(response.message).toContain('Apagar Todo');
    });

    it('should list automations with their state', async () => {
      automationRepo.findAll.mockResolvedValue([
        { id: 'a1', name: 'Auto Luz', enabled: true },
        { id: 'a2', name: 'Auto Clima', enabled: false }
      ]);
      const response = await service.converse({ prompt: 'qué automatizaciones tengo?' }, 'es');
      expect(response.message).toContain('Auto Luz — activa');
      expect(response.message).toContain('Auto Clima — inactiva');
    });
  });

  describe('E/F/G. Management & Confirmations', () => {
    it('rename scene should create pendingManagementAction and require confirmation', async () => {
      sceneRepo.findAll.mockResolvedValue([{ id: 's1', name: 'Modo Cine' }]);
      const response = await service.converse({ prompt: 'renombra la escena Modo Cine a Cine Familiar' }, 'es');
      
      expect(response.type).toBe('clarification');
      expect(response.message).toContain('Voy a renombrar la escena "Modo Cine" a "cine familiar"');
      expect(memory.saveShortTermMemory).toHaveBeenCalledWith('system', expect.objectContaining({
        pendingManagementAction: expect.objectContaining({
          type: 'rename_scene',
          targetId: 's1',
          payload: { newName: 'cine familiar' }
        })
      }));
    });

    it('confirming rename should execute the change', async () => {
      memory.getShortTermMemory.mockResolvedValue({
        pendingManagementAction: {
          type: 'rename_scene',
          targetId: 's1',
          targetName: 'Modo Cine',
          payload: { newName: 'cine familiar' },
          timestamp: new Date().toISOString()
        }
      });
      sceneRepo.findSceneById.mockResolvedValue({ id: 's1', name: 'Modo Cine', actions: [] });

      const response = await service.converse({ prompt: 'sí' }, 'es');
      
      expect(sceneRepo.saveScene).toHaveBeenCalledWith(expect.objectContaining({ name: 'cine familiar' }));
      expect(response.message).toContain('Listo, renombré la escena a "cine familiar"');
    });

    it('toggling automation should require confirmation', async () => {
      automationRepo.findAll.mockResolvedValue([{ id: 'a1', name: 'Auto Luz', enabled: true }]);
      const response = await service.converse({ prompt: 'desactiva la automatizacion Auto Luz' }, 'es');
      
      expect(response.type).toBe('clarification');
      expect(response.message).toContain('Voy a desactivar la automatización "Auto Luz"');
    });
  });

  describe('H. Edit Scene', () => {
    it('adding device to scene should create pending action', async () => {
      sceneRepo.findAll.mockResolvedValue([{ id: 's1', name: 'Modo Noche', actions: [] }]);
      deviceRepo.findAll.mockResolvedValue([{ id: 'd1', name: 'Luz Cocina' }]);
      
      const response = await service.converse({ prompt: 'agrega Luz Cocina a la escena Modo Noche' }, 'es');
      
      expect(response.type).toBe('clarification');
      expect(response.message).toContain('Voy a agregar "Luz Cocina" (apagado) a la escena "Modo Noche"');
    });

    it('removing device from scene should create pending action', async () => {
      sceneRepo.findAll.mockResolvedValue([{ 
        id: 's1', 
        name: 'Modo Noche', 
        actions: [{ deviceId: 'd1', command: { name: 'turn_off', params: {} } }] 
      }]);
      deviceRepo.findAll.mockResolvedValue([{ id: 'd1', name: 'Luz Cocina' }]);
      
      const response = await service.converse({ prompt: 'quita Luz Cocina de la escena Modo Noche' }, 'es');
      
      expect(response.type).toBe('clarification');
      expect(response.message).toContain('Voy a quitar "Luz Cocina" de la escena "Modo Noche"');
    });
  });
});
