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
  createRealSmartEntityResolver,
  createMockSystemVariableService
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
  let roomManagement: any;

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
    roomManagement = { createRoom: jest.fn(), renameRoom: jest.fn(), deleteRoom: jest.fn() };

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
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      roomManagement
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

  describe('Room creation', () => {
    it('asks for a room name instead of using the general conversation fallback', async () => {
      const response = await service.converse({ prompt: 'Puedo agregar una estancia?', userId: 'manager' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'Sí. Dime el nombre de la nueva estancia, por ejemplo: crea una estancia llamada Biblioteca.'
      });
      expect(smallTalk.handle).not.toHaveBeenCalled();
    });

    it('proposes, confirms, and creates a named room through the management port', async () => {
      roomRepo.findAll.mockResolvedValue([]);
      const proposal = await service.converse({ prompt: 'Crea una estancia llamada Biblioteca', userId: 'manager' }, 'es');

      expect(proposal.type).toBe('clarification');
      expect(proposal.message).toContain('Voy a crear la estancia "Biblioteca"');
      const pendingState = memory.saveShortTermMemory.mock.calls.at(-1)?.[1];
      expect(pendingState).toEqual(expect.objectContaining({
        pendingManagementAction: expect.objectContaining({ type: 'create_room', payload: { name: 'Biblioteca' } })
      }));

      memory.getShortTermMemory.mockResolvedValue(pendingState);
      roomManagement.createRoom.mockResolvedValue({ id: 'room-library', name: 'Biblioteca' });
      const response = await service.converse({ prompt: 'sí', userId: 'manager' }, 'es');

      expect(roomManagement.createRoom).toHaveBeenCalledWith(expect.objectContaining({ userId: 'manager', name: 'Biblioteca' }));
      expect(response).toEqual({ type: 'answer', message: 'Listo, creé la estancia "Biblioteca".' });
    });

    it('does not propose a duplicate room name', async () => {
      roomRepo.findAll.mockResolvedValue([{ id: 'room-library', name: 'Biblioteca' }]);

      const response = await service.converse({ prompt: 'Agrega una estancia llamada biblioteca', userId: 'manager' }, 'es');

      expect(response).toEqual({ type: 'answer', message: 'Ya existe una estancia llamada "biblioteca".' });
      expect(roomManagement.createRoom).not.toHaveBeenCalled();
    });

    it('guides the user when a room rename or deletion omits the required room details', async () => {
      const renameResponse = await service.converse({ prompt: 'Renombra una estancia', userId: 'manager' }, 'es');
      const deletionResponse = await service.converse({ prompt: 'Elimina una estancia', userId: 'manager' }, 'es');

      expect(renameResponse).toEqual({
        type: 'answer',
        message: 'Dime qué estancia deseas renombrar y el nuevo nombre, por ejemplo: renombra la estancia Biblioteca a Estudio.'
      });
      expect(deletionResponse).toEqual({
        type: 'answer',
        message: 'Dime qué estancia deseas eliminar, por ejemplo: elimina la estancia Biblioteca.'
      });
    });

    it('proposes, confirms, and renames an authorized room through the management port', async () => {
      roomRepo.findAll.mockResolvedValue([{ id: 'room-library', name: 'Biblioteca' }]);
      const proposal = await service.converse({ prompt: 'Renombra la estancia Biblioteca a Estudio', userId: 'manager' }, 'es');

      expect(proposal.type).toBe('clarification');
      expect(proposal.message).toContain('Voy a cambiar el nombre de la estancia "Biblioteca" a "Estudio"');
      const pendingState = memory.saveShortTermMemory.mock.calls.at(-1)?.[1];
      expect(pendingState).toEqual(expect.objectContaining({
        pendingManagementAction: expect.objectContaining({ type: 'rename_room', targetId: 'room-library', payload: { name: 'Estudio' } })
      }));

      memory.getShortTermMemory.mockResolvedValue(pendingState);
      roomManagement.renameRoom.mockResolvedValue({ id: 'room-library', name: 'Estudio' });
      const response = await service.converse({ prompt: 'sí', userId: 'manager' }, 'es');

      expect(roomManagement.renameRoom).toHaveBeenCalledWith(expect.objectContaining({ userId: 'manager', roomId: 'room-library', name: 'Estudio' }));
      expect(response).toEqual({ type: 'answer', message: 'Listo, la estancia ahora se llama "Estudio".' });
    });

    it('rejects a room rename to an existing authorized room name', async () => {
      roomRepo.findAll.mockResolvedValue([
        { id: 'room-library', name: 'Biblioteca' },
        { id: 'room-study', name: 'Estudio' }
      ]);

      const response = await service.converse({ prompt: 'Renombra la estancia Biblioteca a Estudio', userId: 'manager' }, 'es');

      expect(response).toEqual({ type: 'answer', message: 'Ya existe una estancia llamada "Estudio".' });
      expect(roomManagement.renameRoom).not.toHaveBeenCalled();
    });

    it('discloses device unassignment before deleting a room and deletes only after confirmation', async () => {
      roomRepo.findAll.mockResolvedValue([{ id: 'room-library', name: 'Biblioteca' }]);
      deviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'device-1', roomId: 'room-library' }),
        createTestDevice({ id: 'device-2', roomId: 'room-library' }),
        createTestDevice({ id: 'device-3', roomId: 'other-room' })
      ]);
      const proposal = await service.converse({ prompt: 'Elimina la estancia Biblioteca', userId: 'manager' }, 'es');

      expect(proposal.type).toBe('clarification');
      expect(proposal.message).toContain('2 dispositivos quedarán sin estancia');
      const pendingState = memory.saveShortTermMemory.mock.calls.at(-1)?.[1];
      expect(pendingState).toEqual(expect.objectContaining({
        pendingManagementAction: expect.objectContaining({ type: 'delete_room', targetId: 'room-library' })
      }));

      memory.getShortTermMemory.mockResolvedValue(pendingState);
      roomManagement.deleteRoom.mockResolvedValue({ room: { id: 'room-library', name: 'Biblioteca' }, unassignedDevices: 2 });
      const response = await service.converse({ prompt: 'sí', userId: 'manager' }, 'es');

      expect(roomManagement.deleteRoom).toHaveBeenCalledWith({ userId: 'manager', roomId: 'room-library' });
      expect(response).toEqual({ type: 'answer', message: 'Listo, eliminé la estancia "Biblioteca". 2 dispositivos quedaron sin estancia.' });
    });

    it('cancels a pending room deletion without invoking the management port', async () => {
      memory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'delete_room',
          targetId: 'room-library',
          targetName: 'Biblioteca',
          payload: {},
          timestamp: new Date().toISOString()
        }
      });

      const response = await service.converse({ prompt: 'no', userId: 'manager' }, 'es');

      expect(roomManagement.deleteRoom).not.toHaveBeenCalled();
      expect(response).toEqual({ type: 'answer', message: 'Acción cancelada.' });
    });

    it('revalidates a room before a confirmed deletion', async () => {
      memory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'delete_room',
          targetId: 'room-library',
          targetName: 'Biblioteca',
          payload: {},
          timestamp: new Date().toISOString()
        }
      });
      roomRepo.findAll.mockResolvedValue([]);

      const response = await service.converse({ prompt: 'sí', userId: 'manager' }, 'es');

      expect(roomManagement.deleteRoom).not.toHaveBeenCalled();
      expect(response).toEqual({ type: 'answer', message: 'No encontré la estancia "Biblioteca".' });
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
  describe('I. Confirmed management execution', () => {
    const pendingAction = (type: string, targetId: string, payload: Record<string, unknown>) => ({
      type,
      targetId,
      targetName: 'Target',
      payload,
      timestamp: '2026-08-17T00:00:00.000Z',
    });

    it('persists a confirmed automation state change and clears the pending action', async () => {
      automationRepo.findById.mockResolvedValue({ id: 'a1', name: 'Noche', enabled: false });
      memory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'management_confirm', entities: [], timestamp: '2026-08-17T00:00:00.000Z', pendingManagementAction: pendingAction('toggle_automation', 'a1', { enabled: true }) });
      const response = await (service as unknown as {
        executeManagementAction(action: never, userId: string, language: string): Promise<{ type: string; message: string }>;
      }).executeManagementAction(pendingAction('toggle_automation', 'a1', { enabled: true }) as never, 'manager', 'es');

      expect(automationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', enabled: true }));
      expect(memory.saveShortTermMemory).toHaveBeenCalledWith('manager', expect.objectContaining({ pendingManagementAction: undefined }));
      expect(response).toEqual({ type: 'answer', message: 'Listo, activé la automatización "Noche".' });
    });

    it('adds a confirmed command to a scene and preserves its command contract', async () => {
      const scene = { id: 's1', name: 'Cine', actions: [], updatedAt: '' };
      sceneRepo.findSceneById.mockResolvedValue(scene);
      const response = await (service as unknown as {
        executeManagementAction(action: never, userId: string, language: string): Promise<{ type: string; message: string }>;
      }).executeManagementAction(pendingAction('edit_scene', 's1', { mode: 'add', deviceId: 'light-1', command: 'turn_off' }) as never, 'manager', 'en');

      expect(sceneRepo.saveScene).toHaveBeenCalledWith(expect.objectContaining({
        id: 's1', actions: [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
      }));
      expect(response).toEqual({ type: 'answer', message: 'Ready, updated scene "Cine".' });
    });

    it('removes a confirmed scene action without modifying unrelated actions', async () => {
      const scene = {
        id: 's1',
        name: 'Cine',
        actions: [
          { deviceId: 'light-1', command: { name: 'turn_off', params: {} } },
          { deviceId: 'light-2', command: { name: 'turn_on', params: {} } },
        ],
        updatedAt: '',
      };
      sceneRepo.findSceneById.mockResolvedValue(scene);
      const response = await (service as unknown as {
        executeManagementAction(action: never, userId: string, language: string): Promise<{ type: string; message: string }>;
      }).executeManagementAction(pendingAction('edit_scene', 's1', { mode: 'remove', deviceId: 'light-1' }) as never, 'manager', 'es');

      expect(sceneRepo.saveScene).toHaveBeenCalledWith(expect.objectContaining({
        actions: [{ deviceId: 'light-2', command: { name: 'turn_on', params: {} } }],
      }));
      expect(response).toEqual({ type: 'answer', message: 'Listo, actualicé la escena "Cine".' });
    });

    it('returns a stable error when a confirmed management target no longer exists', async () => {
      sceneRepo.findSceneById.mockResolvedValue(null);
      const response = await (service as unknown as {
        executeManagementAction(action: never, userId: string, language: string): Promise<{ type: string; message: string }>;
      }).executeManagementAction(pendingAction('rename_scene', 'missing', { newName: 'Nuevo nombre' }) as never, 'manager', 'es');

      expect(sceneRepo.saveScene).not.toHaveBeenCalled();
      expect(response).toEqual({ type: 'error', message: 'No se pudo ejecutar la acción de gestión.' });
    });
    it('rejects an incomplete confirmed action without changing a scene or automation', async () => {
      const response = await (service as unknown as {
        executeManagementAction(action: never, userId: string, language: string): Promise<{ type: string; message: string }>;
      }).executeManagementAction(pendingAction('edit_scene', 's1', { mode: 'add', deviceId: 'light-1' }) as never, 'manager', 'es');

      expect(sceneRepo.saveScene).not.toHaveBeenCalled();
      expect(automationRepo.save).not.toHaveBeenCalled();
      expect(response).toEqual({ type: 'error', message: 'INVALID_PAYLOAD: deviceId and valid command are required for add mode' });
    });
  });
});
