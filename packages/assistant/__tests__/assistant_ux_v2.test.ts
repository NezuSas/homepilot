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
    const prompt = 'crea una escena para cine';
    
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

  it('yes without pending: should respond politely without executing anything', async () => {
    memory.getShortTermMemory.mockResolvedValue(null);
    const res = await service.converse({ prompt: 'sí', userId: 'u1' });
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('¿Confirmar qué?');
    expect(sceneExecutionService.execute).not.toHaveBeenCalled();
  });

  it('state query: should group by On/Off professionally', async () => {
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ name: 'Luz 1', lastKnownState: { on: true } as any }),
      createTestDevice({ name: 'Luz 2', lastKnownState: { on: false } as any })
    ]);
    roomRepo.findRoomsByHomeId.mockResolvedValue([]);

    intentInterpreter.interpret.mockResolvedValue({ type: 'unknown' }); // Fallback to handleStateQuery if not matched specifically
    const res = await service.converse({ prompt: 'estado de las luces', userId: 'u1' });
    
    expect(res.message).toContain('Encendidas:');
    expect(res.message).toContain('• Luz 1');
    expect(res.message).toContain('Apagadas:');
    expect(res.message).toContain('• Luz 2');
  });
});
