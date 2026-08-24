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
  createTestRoom,
  createMockSceneExecutionService,
  createMockSystemVariableService,
} from './test_helpers';

describe('Assistant media-player control', () => {
  let service: AssistantConversationService;
  let deviceRepository: ReturnType<typeof createMockDeviceRepository>;
  let sceneExecution: ReturnType<typeof createMockSceneExecutionService>;
  let intentInterpreter: ReturnType<typeof createMockIntentInterpreterPort>;
  let memory: ReturnType<typeof createMockAssistantMemory>;
  let roomRepository: ReturnType<typeof createMockRoomRepository>;

  beforeEach(() => {
    deviceRepository = createMockDeviceRepository();
    sceneExecution = createMockSceneExecutionService();
    intentInterpreter = createMockIntentInterpreterPort();
    memory = createMockAssistantMemory();
    roomRepository = createMockRoomRepository();
    service = new AssistantConversationService(
      intentInterpreter,
      createMockAssistantConfirmationPolicy(),
      sceneExecution,
      createMockDeviceCommandDispatcher(),
      deviceRepository,
      roomRepository,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      memory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
    );
  });

  it('reports the current title, artist and volume of an authorized player without invoking intent interpretation', async () => {
    deviceRepository.findAll.mockResolvedValue([
      createTestDevice({
        id: 'speaker',
        name: 'Z.Tech Speaker',
        type: 'media_player',
        lastKnownState: {
          state: 'playing',
          volume_level: 0.42,
          media_title: 'Midnight City',
          media_artist: 'M83',
        },
      }),
    ]);

    const response = await service.converse({ prompt: 'qué está reproduciendo Z Tech Speaker', userId: 'u1' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Midnight City');
    expect(response.message).toContain('M83');
    expect(response.message).toContain('42%');
    expect(intentInterpreter.interpret).not.toHaveBeenCalled();
  });

  it.each([
    'que reproductores de audio tengo disponibles',
    '¿Qué reproductores de audio tengo disponibles?',
  ])('lists authorized audio players for "$prompt"', async (prompt) => {
    deviceRepository.findAll.mockResolvedValue([
      createTestDevice({ id: 'office', name: 'Pantalla Oficina', type: 'media_player', lastKnownState: { state: 'idle' } }),
      createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player', lastKnownState: { state: 'playing', volume_level: 0.4 } }),
    ]);

    const response = await service.converse({ prompt, userId: 'u1' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Pantalla Oficina');
    expect(response.message).toContain('Z.Tech Speaker');
    expect(intentInterpreter.interpret).not.toHaveBeenCalled();
  });
  it.each(['enciéndelo', 'quiero usarlo'])('turns on the previously reported player for the follow-up "$prompt"', async (prompt) => {
    const player = createTestDevice({ id: 'smart-tv', name: 'Smart TV', type: 'media_player', lastKnownState: { state: 'off', on: false } });
    let storedMemory: Awaited<ReturnType<typeof memory.getShortTermMemory>> = null;
    memory.getShortTermMemory.mockImplementation(async () => storedMemory);
    memory.saveShortTermMemory.mockImplementation(async (_userId, state) => {
      storedMemory = state;
    });
    deviceRepository.findAll.mockResolvedValue([player]);
    deviceRepository.findDeviceById.mockResolvedValue(player);

    await service.converse({ prompt: 'qué reproductores de audio tengo disponibles', userId: 'u1' }, 'es');
    const response = await service.converse({ prompt, userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('Smart TV');
    expect(sceneExecution.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actions: [{ deviceId: 'smart-tv', command: { name: 'turn_on', params: {} } }] }),
      expect.anything(),
    );
    expect(intentInterpreter.interpret).not.toHaveBeenCalled();
  });
  it('explains when the requested player is unavailable instead of attempting an unsafe command', async () => {
    deviceRepository.findAll.mockResolvedValue([
      createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player', lastKnownState: { state: 'unavailable' } }),
    ]);

    const response = await service.converse({ prompt: 'pon el volumen de Z Tech Speaker a 40%', userId: 'u1' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('no está disponible');
    expect(sceneExecution.execute).not.toHaveBeenCalled();
  });

  it('sets an exact requested volume using the existing device command contract', async () => {
    const speaker = createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player', lastKnownState: { state: 'playing', volume_level: 0.2 } });
    deviceRepository.findAll.mockResolvedValue([speaker]);
    deviceRepository.findDeviceById.mockResolvedValue(speaker);

    const response = await service.converse({ prompt: 'pon el volumen de Z Tech Speaker a 45%', userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('45%');
    expect(sceneExecution.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actions: [{ deviceId: 'speaker', command: { name: 'volume_set', params: { volume: 45 } } }] }),
      expect.anything(),
    );
  });

  it('adjusts volume by the requested percentage from the synchronized local state', async () => {
    const speaker = createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player', lastKnownState: { state: 'playing', volume_level: 0.55 } });
    deviceRepository.findAll.mockResolvedValue([speaker]);
    deviceRepository.findDeviceById.mockResolvedValue(speaker);

    const response = await service.converse({ prompt: 'sube el volumen de Z Tech Speaker en 10%', userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('65%');
    expect(sceneExecution.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actions: [{ deviceId: 'speaker', command: { name: 'volume_set', params: { volume: 65 } } }] }),
      expect.anything(),
    );
  });

  it('turns on an off player before applying a supported media command', async () => {
    const speaker = createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player', lastKnownState: { state: 'off', on: false, volume_level: 0.2 } });
    deviceRepository.findAll.mockResolvedValue([speaker]);
    deviceRepository.findDeviceById.mockResolvedValue(speaker);

    const response = await service.converse({ prompt: 'sube el volumen de Z Tech Speaker en 10%', userId: 'u1' }, 'es');

    expect(response.type).toBe('execution');
    expect(response.message).toContain('Encendí Z.Tech Speaker');
    expect(sceneExecution.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actions: [{ deviceId: 'speaker', command: { name: 'turn_on', params: {} } }] }),
      expect.anything(),
    );
    expect(sceneExecution.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actions: [{ deviceId: 'speaker', command: { name: 'volume_set', params: { volume: 30 } } }] }),
      expect.anything(),
    );
  });

  it.each([
    ['qué parlantes tengo en la sala', 'status'],
    ['qué suena en la sala', 'status'],
    ['sube el volumen del parlante de la sala por 10 por ciento', 'volume'],
    ['baja el volumen del parlante de la sala en 15%', 'volume'],
    ['pausa el parlante de la sala', 'pause'],
  ])('understands the natural audio request %s within its HomePilot room', async (prompt, expected) => {
    const sala = createTestRoom({ id: 'sala', name: 'Sala' });
    const speaker = createTestDevice({
      id: 'speaker',
      name: 'Parlante Sala',
      type: 'media_player',
      roomId: sala.id,
      lastKnownState: { state: 'playing', volume_level: 0.5, media_title: 'Noche tranquila' },
    });
    roomRepository.findAll.mockResolvedValue([sala]);
    deviceRepository.findAll.mockResolvedValue([speaker]);
    deviceRepository.findDeviceById.mockResolvedValue(speaker);

    const response = await service.converse({ prompt, userId: 'u1' }, 'es');

    if (expected === 'status') {
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Sala');
      expect(response.message).toContain('Parlante Sala');
      return;
    }

    expect(response.type).toBe('execution');
    const expectedCommand = expected === 'pause'
      ? { name: 'media_pause', params: {} }
      : { name: 'volume_set', params: { volume: prompt.startsWith('sube') ? 60 : 35 } };
    expect(sceneExecution.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actions: [{ deviceId: 'speaker', command: expectedCommand }] }),
      expect.anything(),
    );
  });

  it('states that a room has no imported audio players without querying Home Assistant entities', async () => {
    const comedor = createTestRoom({ id: 'comedor', name: 'Comedor' });
    roomRepository.findAll.mockResolvedValue([comedor]);
    deviceRepository.findAll.mockResolvedValue([
      createTestDevice({ id: 'office', name: 'Pantalla Oficina', type: 'media_player', roomId: 'oficina' }),
    ]);

    const response = await service.converse({ prompt: 'qué altavoces tengo en el comedor', userId: 'u1' }, 'es');

    expect(response.type).toBe('answer');
    expect(response.message.toLowerCase()).toContain('no tienes reproductores de audio importados en comedor');
    expect(sceneExecution.execute).not.toHaveBeenCalled();
    expect(intentInterpreter.interpret).not.toHaveBeenCalled();
  });
  it('asks for the player when a volume command is ambiguous', async () => {
    deviceRepository.findAll.mockResolvedValue([
      createTestDevice({ id: 'office', name: 'Pantalla Oficina', type: 'media_player' }),
      createTestDevice({ id: 'speaker', name: 'Z.Tech Speaker', type: 'media_player' }),
    ]);

    const response = await service.converse({ prompt: 'sube el volumen en 10%', userId: 'u1' }, 'es');

    expect(response.type).toBe('clarification');
    expect(response.clarification?.options.map((option) => option.label)).toEqual(['Pantalla Oficina', 'Z.Tech Speaker']);
    expect(sceneExecution.execute).not.toHaveBeenCalled();
  });
});
