import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockDeviceRepository, 
  createMockSceneRepository, 
  createMockAssistantMemory, 
  createMockFollowUpResolver,
  createMockAssistantConfirmationPolicy,
  createMockDeviceCommandDispatcher,
  createMockIntentInterpreterService,
  createMockRoomRepository,
  createMockAssistantSmallTalk,
  createTestDevice
} from './test_helpers';

describe('AssistantConversationService UX V2', () => {
  let service: AssistantConversationService;
  let intentInterpreter: any;
  let confirmationPolicy: any;
  let sceneExecutionService: any;
  let dispatcher: any;
  let deviceRepo: any;
  let roomRepo: any;
  let sceneRepo: any;
  let smallTalk: any;
  let memory: any;
  let followUp: any;
  let draftService: any;

  beforeEach(() => {
    intentInterpreter = createMockIntentInterpreterService();
    confirmationPolicy = createMockAssistantConfirmationPolicy();
    sceneExecutionService = { execute: jest.fn().mockResolvedValue({ status: 'success', actions: [] }) };
    dispatcher = createMockDeviceCommandDispatcher();
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    sceneRepo = createMockSceneRepository();
    smallTalk = createMockAssistantSmallTalk();
    memory = createMockAssistantMemory();
    followUp = createMockFollowUpResolver();
    draftService = { 
      createSceneDraft: jest.fn(), 
      createAutomationDraft: jest.fn(), 
      activateDraft: jest.fn() 
    };
    deviceRepo.findAll.mockResolvedValue([]);
    roomRepo.findAll.mockResolvedValue([]);
    roomRepo.findRoomsByHomeId.mockResolvedValue([]);

    service = new AssistantConversationService(
      intentInterpreter,
      confirmationPolicy,
      sceneExecutionService as any,
      dispatcher,
      deviceRepo,
      roomRepo,
      sceneRepo,
      smallTalk,
      memory,
      followUp,
      draftService
    );
  });

  it('apaga todo: should require confirmation and then execute on "yes"', async () => {
    const prompt = 'apaga todo';
    const userId = 'u1';
    
    // 1. Initial request
    intentInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: 'all',
      command: 'turn_off',
      prompt
    });
    confirmationPolicy.evaluate.mockResolvedValue({
      requiresConfirmation: true,
      reason: 'Global command',
      summary: 'Turning off everything'
    });
    deviceRepo.findAll.mockResolvedValue([]); // For findMatchingDevices

    const res1 = await service.converse({ prompt, userId });
    
    expect(res1.type).toBe('clarification');
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: expect.objectContaining({ command: 'turn_off' })
    }));

    // 2. Positive confirmation
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: { type: 'command', deviceId: 'all', command: 'turn_off', prompt, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      entities: []
    });

    const res2 = await service.converse({ prompt: 'sí', userId });
    
    expect(res2.type).toBe('execution');
    expect(sceneExecutionService.execute).toHaveBeenCalled();
  });

  it('apaga todo: should cancel on "no"', async () => {
    const userId = 'u1';
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: { type: 'command', deviceId: 'all', command: 'turn_off', prompt: 'apaga todo', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      entities: []
    });

    const res = await service.converse({ prompt: 'no', userId });
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('cancelada');
    // Verify memory cleanup
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: undefined
    }));
  });

  it('confirmation: should NOT execute if pendingIntent is expired (>5m)', async () => {
    const userId = 'u1';
    const expiredDate = new Date(Date.now() - 400000).toISOString(); // > 6 mins
    
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: { type: 'command', deviceId: 'all', command: 'turn_off', prompt: 'apaga todo', timestamp: expiredDate },
      timestamp: new Date().toISOString(),
      entities: []
    });

    // We need to mock interpretation because since it's expired, it will fallback to regular flow
    intentInterpreter.interpret.mockResolvedValue({ type: 'unknown' });
    smallTalk.handle.mockResolvedValue({ type: 'answer', message: 'expired' });

    await service.converse({ prompt: 'sí', userId });
    
    // Should have cleared memory
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: undefined
    }));
  });

  it('new intent: should clear pending actions to avoid context mixing', async () => {
    const userId = 'u1';
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: { type: 'command', deviceId: 'all', command: 'turn_off', prompt: 'apaga todo', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      entities: []
    });

    intentInterpreter.interpret.mockResolvedValue({
      type: 'command',
      deviceId: 'light-1',
      command: 'turn_on',
      prompt: 'enciende luz'
    });
    confirmationPolicy.evaluate.mockResolvedValue({ requiresConfirmation: false });
    deviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'light-1', name: 'Luz' }));
    deviceRepo.findAll.mockResolvedValue([]);

    await service.converse({ prompt: 'enciende luz', userId });

    // Should have cleared previous pending intent before executing new one
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: undefined
    }));
  });

  it('draft: should create draft and then activate on "yes"', async () => {
    const userId = 'u1';
    const prompt = 'crea una escena para cine en la sala';
    
    roomRepo.findAll.mockResolvedValue([{ id: 'sala-id', name: 'Sala', homeId: 'h1' }]);
    deviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz', roomId: 'sala-id', homeId: 'h1', type: 'light' })]);
    draftService.createSceneDraft.mockResolvedValue({ id: 'd-1', type: 'scene' });

    const res1 = await service.converse({ prompt, userId });
    
    expect(res1.type).toBe('clarification');
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingDraft: { id: 'd-1', type: 'scene', originalPrompt: expect.any(String) }
    }));

    // Activate
    memory.getShortTermMemory.mockResolvedValue({
      pendingDraft: { id: 'd-1', type: 'scene', originalPrompt: prompt },
      timestamp: new Date().toISOString(),
      entities: []
    });

    const res2 = await service.converse({ prompt: 'sí', userId });
    
    expect(res2.type).toBe('answer');
    expect(res2.message).toContain('activado');
    expect(draftService.activateDraft).toHaveBeenCalledWith('d-1', userId);
  });

  it('BUG A: "la primera" should resolve selection using clarificationOptions and pendingIntent', async () => {
    const userId = 'u1';
    const options = [
      { id: 'dev-1', label: 'Luz Escritorio', kind: 'device' as const },
      { id: 'dev-2', label: 'Luz Techo', kind: 'device' as const }
    ];
    
    memory.getShortTermMemory.mockResolvedValue({
      clarificationOptions: options,
      pendingIntent: { type: 'command', command: 'turn_off', deviceId: undefined, timestamp: new Date().toISOString() },
      originalPrompt: 'apaga la luz',
      entities: [],
      timestamp: new Date().toISOString()
    });

    deviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'dev-1', name: 'Luz Escritorio' }));
    
    const res = await service.converse({ prompt: 'la primera', userId });

    expect(res.type).toBe('execution');
    expect(sceneExecutionService.execute).toHaveBeenCalledWith(expect.objectContaining({
      actions: expect.arrayContaining([
        expect.objectContaining({ deviceId: 'dev-1', command: expect.objectContaining({ name: 'turn_off' }) })
      ])
    }), expect.anything());
  });

  it('BUG A: selection without command should save to entities and ask what to do', async () => {
    const userId = 'u1';
    const options = [{ id: 'dev-1', label: 'Luz Escritorio', kind: 'device' as const }];
    
    memory.getShortTermMemory.mockResolvedValue({
      clarificationOptions: options,
      entities: [],
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({ prompt: 'Luz Escritorio', userId });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Seleccioné Luz Escritorio');
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      entities: [expect.objectContaining({ id: 'dev-1' })]
    }));
  });

  it('BUG B: draft creation should have priority over state query', async () => {
    const userId = 'u1';
    // This prompt contains "estado" and "habitacion" which are state query triggers,
    // but also "crea una escena" which is a draft creation trigger.
    const prompt = 'crea una escena para el estado de la habitacion sala';
    
    deviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz Sala', roomId: 'r1' })]);
    roomRepo.findAll.mockResolvedValue([{ id: 'r1', name: 'Sala', homeId: 'h1' }]);
    draftService.createSceneDraft.mockResolvedValue({ id: 'd-1', type: 'scene' });

    const res = await service.converse({ prompt, userId });

    expect(res.type).toBe('clarification');
    expect(draftService.createSceneDraft).toHaveBeenCalled();
  });

  it('BUG B: draft creation should resolve room and devices', async () => {
    const userId = 'u1';
    const roomMasterId = 'room-master';
    
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Luz Master 1', roomId: roomMasterId, type: 'light', homeId: 'h1' }),
      createTestDevice({ id: 'light-2', name: 'Luz Master 2', roomId: roomMasterId, type: 'light', homeId: 'h1' }),
      createTestDevice({ id: 'other', name: 'Other', roomId: 'other-room', homeId: 'h1' })
    ]);
    
    roomRepo.findAll.mockResolvedValue([
      { id: roomMasterId, name: 'Cuarto Master', homeId: 'h1' }
    ]);

    draftService.createSceneDraft.mockResolvedValue({ id: 'draft-123', type: 'scene' });

    const res = await service.converse({ prompt: 'crea una escena para apagar el cuarto master', userId });

    expect(res.type).toBe('clarification');
    expect(draftService.createSceneDraft).toHaveBeenCalledWith(
      'h1',
      roomMasterId,
      expect.stringContaining('Apagar Cuarto Master'),
      expect.arrayContaining([
        expect.objectContaining({ deviceId: 'light-1', command: expect.objectContaining({ name: 'turn_off' }) }),
        expect.objectContaining({ deviceId: 'light-2', command: expect.objectContaining({ name: 'turn_off' }) })
      ]),
      expect.any(String)
    );
  });

  it('BUG B: should not create empty draft', async () => {
    const userId = 'u1';
    deviceRepo.findAll.mockResolvedValue([]);
    roomRepo.findAll.mockResolvedValue([]);

    const res = await service.converse({ prompt: 'crea una escena para la luna', userId });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré dispositivos');
    expect(draftService.createSceneDraft).not.toHaveBeenCalled();
  });

  it('BUG B: room mentioned but not found in DB', async () => {
    const userId = 'u1';
    deviceRepo.findAll.mockResolvedValue([]);
    roomRepo.findAll.mockResolvedValue([]);

    const res = await service.converse({ prompt: 'crea una escena para el cuarto master', userId });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré la estancia "cuarto master"');
  });

  it('BUG B: room found but no controllable devices', async () => {
    const userId = 'u1';
    const roomId = 'r1';
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'sensor-1', name: 'Sensor Movimiento', roomId, type: 'sensor' })
    ]);
    roomRepo.findAll.mockResolvedValue([{ id: roomId, name: 'Baño', homeId: 'h1' }]);

    const res = await service.converse({ prompt: 'crea una escena para el baño', userId });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré luces, interruptores o dispositivos controlables en Baño para crear esa escena.');
  });

  it('BUG B: draft service failure should not throw 500', async () => {
    const userId = 'u1';
    const roomId = 'r1';
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Luz', roomId, type: 'light', homeId: 'h1' })
    ]);
    roomRepo.findAll.mockResolvedValue([{ id: roomId, name: 'Sala', homeId: 'h1' }]);
    
    draftService.createSceneDraft.mockRejectedValue(new Error('DB_FAIL'));

    const res = await service.converse({ prompt: 'crea una escena para la sala', userId });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('No pude preparar el borrador');
  });

  it('BUG B: draft creation should NOT execute any command', async () => {
    const userId = 'u1';
    const roomId = 'r1';
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Luz', roomId, type: 'light', homeId: 'h1' })
    ]);
    roomRepo.findAll.mockResolvedValue([{ id: roomId, name: 'Sala', homeId: 'h1' }]);
    draftService.createSceneDraft.mockResolvedValue({ id: 'd1', type: 'scene' });

    await service.converse({ prompt: 'crea una escena para la sala', userId });

    expect(sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('yes without pending: should respond politely without executing anything', async () => {
    memory.getShortTermMemory.mockResolvedValue(null);
    const res = await service.converse({ prompt: 'sí', userId: 'u1' });
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('¿Confirmar qué?');
    expect(sceneExecutionService.execute).not.toHaveBeenCalled();
  });

  it('room query: should list all rooms from DB', async () => {
    const rooms = [
      { id: 'r1', name: 'Sala', homeId: 'h1' },
      { id: 'r2', name: 'Cocina', homeId: 'h1' }
    ];
    roomRepo.findAll.mockResolvedValue(rooms);

    const res = await service.converse({ prompt: 'qué estancias conoces', userId: 'u1' });

    expect(res.type).toBe('answer');
    expect(res.message).toContain('Conozco estas estancias:');
    expect(res.message).toContain('• Sala');
    expect(res.message).toContain('• Cocina');
  });

  it('BUG B: matching "cuarto master" with "Cuarto Master" room name', async () => {
    const userId = 'u1';
    const roomId = 'room-master';
    
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Luz', roomId, type: 'light', homeId: 'h1' })
    ]);
    roomRepo.findAll.mockResolvedValue([
      { id: roomId, name: 'Cuarto Master', homeId: 'h1' }
    ]);
    draftService.createSceneDraft.mockResolvedValue({ id: 'draft-1', type: 'scene' });

    const res = await service.converse({ prompt: 'crea una escena para apagar el cuarto master', userId });

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Cuarto Master');
    expect(draftService.createSceneDraft).toHaveBeenCalledWith(
      'h1',
      roomId,
      expect.stringContaining('Apagar Cuarto Master'),
      expect.any(Array),
      expect.any(String)
    );
  });

  it('state query: should group by On/Off professionally', async () => {
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ name: 'Luz 1', lastKnownState: { on: true } as any }),
      createTestDevice({ name: 'Luz 2', lastKnownState: { on: false } as any })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    intentInterpreter.interpret.mockResolvedValue({ type: 'unknown' });
    const res = await service.converse({ prompt: 'estado de las luces', userId: 'u1' });
    
    expect(res.message).toContain('Encendidas:');
    expect(res.message).toContain('• Luz 1');
    expect(res.message).toContain('Apagadas:');
    expect(res.message).toContain('• Luz 2');
  });
});
