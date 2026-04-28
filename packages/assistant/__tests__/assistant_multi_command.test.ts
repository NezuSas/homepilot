import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockDeviceRepository, 
  createMockSceneRepository, 
  createMockAssistantMemory, 
  createMockFollowUpResolver,
  createMockDeviceCommandDispatcher,
  createMockRoomRepository,
  createMockAssistantSmallTalk,
  createTestDevice
} from './test_helpers';
import { IntentInterpreterService } from '../application/IntentInterpreterService';
import { AssistantConfirmationPolicy } from '../application/AssistantConfirmationPolicy';

describe('AssistantConversationService - Multi-Command V1', () => {
  let service: AssistantConversationService;
  let intentInterpreter: IntentInterpreterService;
  let confirmationPolicy: AssistantConfirmationPolicy;
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
    jest.clearAllMocks();
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    sceneRepo = createMockSceneRepository();
    
    // Use real instances for the parser and confirmation policy to test the full logic
    intentInterpreter = new IntentInterpreterService(deviceRepo, sceneRepo, roomRepo);
    confirmationPolicy = new AssistantConfirmationPolicy(sceneRepo, deviceRepo);
    
    sceneExecutionService = { execute: jest.fn().mockResolvedValue({ status: 'success', actions: [] }) };
    dispatcher = createMockDeviceCommandDispatcher();
    smallTalk = createMockAssistantSmallTalk();
    memory = createMockAssistantMemory();
    followUp = createMockFollowUpResolver();
    draftService = { createSceneDraft: jest.fn(), createAutomationDraft: jest.fn(), activateDraft: jest.fn() };

    service = new AssistantConversationService(
      intentInterpreter as any,
      confirmationPolicy,
      sceneExecutionService as any,
      dispatcher,
      deviceRepo,
      roomRepo,
      sceneRepo,
      smallTalk,
      memory,
      followUp,
      draftService as any,
      { findAll: jest.fn(), findById: jest.fn(), save: jest.fn(), delete: jest.fn() } as any
    );
  });

  it('1. "apaga luz sala y prende luz cocina" should require confirmation and execute both', async () => {
    const userId = 'u1';
    const prompt = 'apaga luz sala y prende luz cocina';
    
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Luz Cocina', type: 'light' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    // 1. Initial request -> Clarification / Confirmation
    const res1 = await service.converse({ prompt, userId });
    expect(res1.type).toBe('clarification');
    expect(res1.clarification?.question).toContain('¿Estás seguro');
    
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: expect.objectContaining({
        type: 'multi_command',
        actions: [
          { deviceId: 'd1', command: 'turn_off', targetName: 'Luz Sala' },
          { deviceId: 'd2', command: 'turn_on', targetName: 'Luz Cocina' }
        ]
      })
    }));

    // 2. User confirms
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: {
        type: 'multi_command',
        prompt,
        actions: [
          { deviceId: 'd1', command: 'turn_off', targetName: 'Luz Sala' },
          { deviceId: 'd2', command: 'turn_on', targetName: 'Luz Cocina' }
        ],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      entities: []
    });

    deviceRepo.findDeviceById.mockImplementation((id: string) => {
      if (id === 'd1') return Promise.resolve(createTestDevice({ id: 'd1', name: 'Luz Sala' }));
      if (id === 'd2') return Promise.resolve(createTestDevice({ id: 'd2', name: 'Luz Cocina' }));
      return Promise.resolve(null);
    });

    // Mock successful execution
    service['executeSingleCommand'] = jest.fn().mockResolvedValue({ status: 'success', actions: [] });

    const res2 = await service.converse({ prompt: 'sí', userId });
    
    expect(res2.type).toBe('execution');
    expect(res2.message).toContain('Ejecuté las 2 acciones correctamente');
    expect(service['executeSingleCommand']).toHaveBeenCalledTimes(2);
    expect(service['executeSingleCommand']).toHaveBeenCalledWith('d1', 'turn_off', expect.any(String), expect.any(String));
    expect(service['executeSingleCommand']).toHaveBeenCalledWith('d2', 'turn_on', expect.any(String), expect.any(String));
  });

  it('2. "apaga todo menos la cocina" should resolve room and exclude its devices', async () => {
    const userId = 'u1';
    const prompt = 'apaga todo menos la cocina';
    
    roomRepo.findAll.mockResolvedValue([{ id: 'r1', name: 'Cocina', homeId: 'h1' }]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r2' }),
      createTestDevice({ id: 'd2', name: 'Foco Patio', type: 'light', roomId: 'r3' }),
      createTestDevice({ id: 'd3', name: 'Luz Cocina', type: 'light', roomId: 'r1' }) // Should be excluded
    ]);

    const res1 = await service.converse({ prompt, userId });
    expect(res1.type).toBe('clarification');
    
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: expect.objectContaining({
        type: 'multi_command',
        actions: [
          expect.objectContaining({ deviceId: 'd1' }),
          expect.objectContaining({ deviceId: 'd2' })
        ]
      })
    }));
  });

  it('3. "apaga todo menos la luz de cocina" should exclude specific device', async () => {
    const userId = 'u1';
    const prompt = 'apaga todo menos la luz de cocina';
    
    roomRepo.findAll.mockResolvedValue([]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Luz de Cocina', type: 'light' }), // Exact match or contains
      createTestDevice({ id: 'd3', name: 'Foco Baño', type: 'light' })
    ]);

    const res1 = await service.converse({ prompt, userId });
    expect(res1.type).toBe('clarification');
    
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: expect.objectContaining({
        actions: [
          expect.objectContaining({ deviceId: 'd1' }),
          expect.objectContaining({ deviceId: 'd3' })
        ]
      })
    }));
  });

  it('5. Ambiguity: "apaga la luz y prende la cocina" should ask for clarification if "luz" matches many', async () => {
    const userId = 'u1';
    const prompt = 'apaga la luz y prende la cocina';
    
    roomRepo.findAll.mockResolvedValue([{ id: 'r1', name: 'Cocina' }]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Luz Baño', type: 'light' }),
      createTestDevice({ id: 'd3', name: 'Luz Cocina', type: 'light', roomId: 'r1' })
    ]);

    const res1 = await service.converse({ prompt, userId });
    expect(res1.type).toBe('clarification');
    expect(res1.clarification?.question).toContain('cuál');
    expect(res1.clarification?.options).toHaveLength(3); // Luz Sala, Luz Baño, Luz Cocina
    
    // No multi_command intent should be created yet
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      lastQueryType: 'clarification',
      clarificationOptions: expect.any(Array)
    }));
  });

  it('6. No match: "apaga el horno y prende el freezer" should fail cleanly if devices do not exist', async () => {
    const userId = 'u1';
    const prompt = 'apaga el horno y prende el freezer';
    
    roomRepo.findAll.mockResolvedValue([{ id: 'r1', name: 'Sala' }]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Foco Jardin', type: 'light', roomId: 'r1' })
    ]);

    const res1 = await service.converse({ prompt, userId });
    expect(res1.type).toBe('error');
    expect(res1.message).toContain('No pude encontrar');
  });

  it('7. Cancellation: "no" clears pending intent', async () => {
    const userId = 'u1';
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: { type: 'multi_command', actions: [], timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });

    const res = await service.converse({ prompt: 'no', userId });
    expect(res.type).toBe('answer');
    expect(res.message).toContain('cancelada');
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith(userId, expect.objectContaining({
      pendingIntent: undefined
    }));
  });

  it('8. Partial failure: returns partial execution summary', async () => {
    const userId = 'u1';
    memory.getShortTermMemory.mockResolvedValue({
      pendingIntent: {
        type: 'multi_command',
        prompt: 'test',
        actions: [
          { deviceId: 'd1', command: 'turn_on', targetName: 'Luz 1' },
          { deviceId: 'd2', command: 'turn_on', targetName: 'Luz 2' }
        ],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      entities: []
    });

    deviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(createTestDevice({ id, name: id })));

    service['executeSingleCommand'] = jest.fn()
      .mockResolvedValueOnce({ status: 'success', actions: [] })
      .mockResolvedValueOnce({ status: 'failed', actions: [{ error: 'Device unreachable' }] });

    const res = await service.converse({ prompt: 'sí', userId });
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Ejecuté 1 de 2 acciones');
    expect(res.message).toContain('Device unreachable');
  });
});
