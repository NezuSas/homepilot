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
  createMockAssistantSuggestionService,
  createTestDevice,
  createTestRoom,
  createMockSystemVariableService,
  createRealSmartEntityResolver
} from './test_helpers';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';

describe('Assistant Semantic Hardening', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockDispatcher: any;
  let mockInterpreter: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockInterpreter = createMockIntentInterpreterService();
    
    const mockExecutionRepo = createMockExecutionRecordRepository();
    const mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);

    service = new AssistantConversationService(
      mockInterpreter,
      createMockAssistantConfirmationPolicy(),
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, createMockSceneRepository(), createMockAutomationRuleRepository(), mockMemory, createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      mockExecutionRepo,
      createMockSystemVariableService()
    );
  });

  it('Room named "Dormitorio" is not auto-treated as "mi cuarto" without user alias', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Dormitorio' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    // This is a room bulk command or similar. 
    // In singular light path, it tries to resolve room.
    const res = await (service as any).resolveRoomAlias('mi cuarto', [createTestRoom({ id: 'r1', name: 'Dormitorio' })], [], 'u1', {});
    expect(res.status).toBe('not_found');
  });

  it('"apaga la luz de mi cuarto" returns not found/asks safely when no alias exists', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Dormitorio' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'd1', name: 'Luz', type: 'light', roomId: 'r1' })
    ]);
    mockMemory.getAliases.mockResolvedValue({});
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown' });

    const res = await service.converse({ prompt: 'apaga la luz de mi cuarto', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No entendí ese comando');
  });

  it('State query with unknown room returns "No encontré esa estancia"', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await (service as any).handleStateQuery('qué luces hay en el garaje', 'es', 'User', 'u1');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré esa estancia');
  });

  it('Device named "test light" is matchable if available', async () => {
    const testDevice = createTestDevice({ id: 'd1', name: 'test light', status: 'ASSIGNED', lastKnownState: { state: 'on' } });
    mockDeviceRepo.findAll.mockResolvedValue([testDevice]);

    const matches = await (service as any).findMatchingDevices('test light', 'u1');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('d1');
  });

  it('Unavailable device is excluded by state, not name', async () => {
    const unavailableDevice = createTestDevice({ 
        id: 'd1', 
        name: 'Luz Cocina', 
        lastKnownState: { state: 'unavailable' } 
    });
    mockDeviceRepo.findAll.mockResolvedValue([unavailableDevice]);

    const matches = await (service as any).findMatchingDevices('Luz Cocina', 'u1');
    expect(matches).toHaveLength(0);
  });

  it('"estado de la cocina" returns room not found if Cocina is not in RoomRepository', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await service.converse({ prompt: 'qué luces hay en la cocina', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré esa estancia');
  });

  it('Draft creation for "Dormitorio" fails if no room or alias exists', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala' })
    ]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    mockMemory.getAliases.mockResolvedValue({});

    const res = await service.converse({ prompt: 'crea una escena para el dormitorio', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('No encontré la estancia');
  });

  it('After "prende la luz" room clarification, typing "Cuarto Master" selects the room', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', name: 'Luz', type: 'light', roomId: 'r1', homeId: 'h1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockDeviceRepo.findDeviceById.mockResolvedValue(devices[0]);
    mockMemory.getAliases.mockResolvedValue({});
    
    // Simulate pending clarification
    const memoryState = {
      lastQueryType: 'clarification' as const,
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [{ id: 'r1', label: 'Cuarto Master', kind: 'room' as const }],
      originalPrompt: 'prende la luz'
    };
    mockMemory.getShortTermMemory.mockResolvedValue(memoryState);

    const res = await service.converse({ prompt: 'Cuarto Master', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz');
  });

  it('After room clarification, typing "apaga todo el cuarto master" bypasses selection', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', name: 'Luz', type: 'light', roomId: 'r1', homeId: 'h1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getAliases.mockResolvedValue({});
    
    // Simulate pending clarification
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [{ id: 'r1', label: 'Cuarto Master', kind: 'room' }],
      originalPrompt: 'prende la luz'
    });

    const res = await service.converse({ prompt: 'apaga todo el cuarto master', userId: 'u1' }, 'es');
    
    // Should NOT be a selection. Should be a bulk action confirmation.
    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 1 dispositivos en Cuarto Master');
    // Verify memory was cleared
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      clarificationOptions: undefined
    }));
  });

  it('After room clarification, typing "estado del cuarto master" bypasses selection', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', name: 'Luz', type: 'light', roomId: 'r1', homeId: 'h1', lastKnownState: { state: 'on' } })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getAliases.mockResolvedValue({});
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [{ id: 'r1', label: 'Cuarto Master', kind: 'room' }],
      originalPrompt: 'prende la luz'
    });

    const res = await service.converse({ prompt: 'estado del cuarto master', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain('estado en Cuarto Master');
  });

  it('UI selectedOptionId still resolves room selection regardless of prompt text', async () => {
    const rooms = [createTestRoom({ id: 'r1', name: 'Cuarto Master' })];
    const devices = [createTestDevice({ id: 'l1', name: 'Luz', type: 'light', roomId: 'r1', homeId: 'h1' })];
    mockRoomRepo.findAll.mockResolvedValue(rooms);
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockDeviceRepo.findDeviceById.mockResolvedValue(devices[0]);
    mockMemory.getAliases.mockResolvedValue({});
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'clarification',
      entities: [],
      timestamp: new Date().toISOString(),
      clarificationOptions: [{ id: 'r1', label: 'Cuarto Master', kind: 'room' }],
      originalPrompt: 'prende la luz'
    });

    // Prompt "apaga todo" would normally block selection, but selectedOptionId must win
    const res = await service.converse({ prompt: 'apaga todo', selectedOptionId: 'r1', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('execution');
    expect(res.message).toContain('Encendí Luz');
  });

  describe('Alias Suggestion Persistence', () => {
    const userId = 'u1';

    it('accepting alias_suggestion for room stores room.id, not room.name', async () => {
      const room = createTestRoom({ id: 'room-123', name: 'Cuarto Master' });
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getAlias.mockResolvedValue(null);

      const suggestion = {
        id: 's1',
        type: 'alias_suggestion',
        metadata: { alias: 'mi oficina', target: 'Cuarto Master', confidence: 'high' }
      };

      // Mock isSuggestionAccept to return true for "yes"
      mockMemory.getShortTermMemory.mockResolvedValue({ pendingSuggestion: suggestion, entities: [], timestamp: new Date().toISOString() });

      const res = await service.converse({ prompt: 'sí', userId }, 'es');

      expect(res.message).toContain('entenderé "mi oficina" como "Cuarto Master"');
      expect(mockMemory.setAlias).toHaveBeenCalledWith(userId, 'mi oficina', 'room-123');
    });

    it('accepting alias_suggestion for device stores device.id, not device.name', async () => {
      const device = createTestDevice({ id: 'dev-456', name: 'Luz Escritorio' });
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([device]);
      mockMemory.getAlias.mockResolvedValue(null);

      const suggestion = {
        id: 's2',
        type: 'alias_suggestion',
        metadata: { alias: 'foco trabajo', target: 'Luz Escritorio', confidence: 'high' }
      };

      mockMemory.getShortTermMemory.mockResolvedValue({ pendingSuggestion: suggestion, entities: [], timestamp: new Date().toISOString() });

      const res = await service.converse({ prompt: 'sí', userId }, 'es');

      expect(res.message).toContain('entenderé "foco trabajo" como "Luz Escritorio"');
      expect(mockMemory.setAlias).toHaveBeenCalledWith(userId, 'foco trabajo', 'dev-456');
    });

    it('ambiguous target does not store alias and returns clarification', async () => {
      const rooms = [
        createTestRoom({ id: 'r1', name: 'Sala' }),
        createTestRoom({ id: 'r2', name: 'Sala' })
      ];
      mockRoomRepo.findAll.mockResolvedValue(rooms);
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getAlias.mockResolvedValue(null);

      const suggestion = {
        id: 's3',
        type: 'alias_suggestion',
        metadata: { alias: 'mi sala', target: 'Sala', confidence: 'high' }
      };

      mockMemory.getShortTermMemory.mockResolvedValue({ pendingSuggestion: suggestion, entities: [], timestamp: new Date().toISOString() });

      const res = await service.converse({ prompt: 'sí', userId }, 'es');

      expect(res.message).toContain('Encontré varios elementos llamados "Sala"');
      expect(mockMemory.setAlias).not.toHaveBeenCalled();
    });

    it('not found target does not store alias and returns error', async () => {
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getAlias.mockResolvedValue(null);

      const suggestion = {
        id: 's4',
        type: 'alias_suggestion',
        metadata: { alias: 'mi oficina', target: 'Oficina Inexistente', confidence: 'high' }
      };

      mockMemory.getShortTermMemory.mockResolvedValue({ pendingSuggestion: suggestion, entities: [], timestamp: new Date().toISOString() });

      const res = await service.converse({ prompt: 'sí', userId }, 'es');

      expect(res.message).toContain('No encontré el dispositivo o estancia "Oficina Inexistente"');
      expect(mockMemory.setAlias).not.toHaveBeenCalled();
    });
  });

  describe('Semantic Type Classification (Fix 1)', () => {
    it('automatic HA switch named as a light is included in light state queries', async () => {
      const haLight = createTestDevice({
        id: 'ha-sw-light',
        name: 'Luz Sala',
        type: 'switch',
        semanticType: null,
        lastKnownState: { state: 'off' }
      });
      mockDeviceRepo.findAll.mockResolvedValue([haLight]);
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'qué luces están apagadas', userId: 'u1' }, 'es');

      expect(res.message).toContain('Luz Sala');
      expect(res.message).not.toContain('No hay luces apagadas');
    });

    it('manual switch classification overrides a light-like device name', async () => {
      const explicitSwitch = createTestDevice({
        id: 'ha-sw-explicit',
        name: 'Luz Decorativa',
        type: 'switch',
        semanticType: 'switch',
        lastKnownState: { state: 'off' }
      });
      mockDeviceRepo.findAll.mockResolvedValue([explicitSwitch]);
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'qué luces están apagadas', userId: 'u1' }, 'es');

      expect(res.message).not.toContain('Luz Decorativa');
    });

    it('switch device with semanticType=light is included in "apaga todas las luces"', async () => {
      // HA may report a physical light as type: 'switch'. semanticType overrides.
      const haLight = createTestDevice({
        id: 'ha-sw-1', name: 'Lámpara Comedor', type: 'switch', roomId: 'r1',
        semanticType: 'light'
      });
      const regularSwitch = createTestDevice({
        id: 'sw-2', name: 'Enchufe Cocina', type: 'switch', roomId: 'r1'
        // no semanticType → not a light
      });
      const room = createTestRoom({ id: 'r1', name: 'Sala' });

      mockDeviceRepo.findAll.mockResolvedValue([haLight, regularSwitch]);
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'apaga todas las luces sala', userId: 'u1' }, 'es');

      // haLight should be included; regularSwitch excluded (no semanticType=light)
      expect(res.type).toBe('clarification');
      const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
      expect(saveCall.pendingBulkAction.deviceIds).toContain('ha-sw-1');
      expect(saveCall.pendingBulkAction.deviceIds).not.toContain('sw-2');
    });

    it('switch device with semanticType=switch is NOT included in light bulk', async () => {
      const sw = createTestDevice({
        id: 'sw-1', name: 'Switch Ventilador', type: 'switch', semanticType: 'switch'
      });
      mockDeviceRepo.findAll.mockResolvedValue([sw]);
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'apaga todas las luces', userId: 'u1' }, 'es');

      expect(res.type).toBe('answer');
      expect(res.message).toContain('No encontré luces');
    });

    it('"todo" still includes controllable switches regardless of semanticType', async () => {
      const sw = createTestDevice({
        id: 'sw-1', name: 'Ventilador', type: 'switch', roomId: 'r1'
      });
      const room = createTestRoom({ id: 'r1', name: 'Sala' });
      mockDeviceRepo.findAll.mockResolvedValue([sw]);
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockMemory.getAliases.mockResolvedValue({});

      // "todo" uses bulkType = 'all', so it should NOT filter out switches
      const res = await service.converse({ prompt: 'apaga todo en la sala', userId: 'u1' }, 'es');

      expect(res.type).toBe('clarification');
      const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
      expect(saveCall.pendingBulkAction.deviceIds).toContain('sw-1');
      expect(saveCall.pendingBulkAction.bulkType).toBe('all');
    });
  });

  describe('Typo lux must not route to room singular light (Fix 2)', () => {
    it('"prende lux sala" does NOT route to isRoomSingularLightFastPath', () => {
      // Internal unit test: verify the regex explicitly rejects 'lux'
      const result = (service as any).isRoomSingularLightFastPath('prende lux sala');
      expect(result).toBeNull();
    });

    it('"prende luz sala" DOES route to isRoomSingularLightFastPath', () => {
      const result = (service as any).isRoomSingularLightFastPath('prende luz sala');
      expect(result).not.toBeNull();
      expect(result?.roomName).toBe('sala');
      expect(result?.command).toBe('turn_on');
    });
  });

  describe('Multi-command singular phrase must not expand rooms (Fix 3)', () => {
    it('"prende luz sala y apaga cocina" returns clarification — not 9 actions', async () => {
      const sala = createTestRoom({ id: 'r-sala', name: 'Sala' });
      const cocina = createTestRoom({ id: 'r-cocina', name: 'Cocina' });
      // Multiple devices in each room
      const devices = [
        createTestDevice({ id: 'd1', name: 'Luz Sala 1', type: 'light', roomId: 'r-sala' }),
        createTestDevice({ id: 'd2', name: 'Luz Sala 2', type: 'light', roomId: 'r-sala' }),
        createTestDevice({ id: 'd3', name: 'Switch Sala', type: 'switch', roomId: 'r-sala' }),
        createTestDevice({ id: 'd4', name: 'Luz Cocina 1', type: 'light', roomId: 'r-cocina' }),
        createTestDevice({ id: 'd5', name: 'Switch Cocina', type: 'switch', roomId: 'r-cocina' }),
      ];
      mockRoomRepo.findAll.mockResolvedValue([sala, cocina]);
      mockDeviceRepo.findAll.mockResolvedValue(devices);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'prende luz sala y apaga cocina', userId: 'u1' }, 'es');

      // Must NOT produce an execution with many actions — must clarify or fail, not silently expand
      expect(res.type).not.toBe('execution');
      // Either clarification (if resolved to multi_command but ambiguous) or falls through
      // The key assertion: NO execution with > 2 actions was produced
      if (res.type === 'execution') {
        // If execution happened, it should never have been dispatched to all 9 devices
        fail('Should not silently execute a multi-room expansion');
      }
    });

    it('"apaga todo cocina" can produce room bulk confirmation (explicit bulk keyword)', async () => {
      const cocina = createTestRoom({ id: 'r-cocina', name: 'Cocina' });
      const d1 = createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r-cocina' });
      mockRoomRepo.findAll.mockResolvedValue([cocina]);
      mockDeviceRepo.findAll.mockResolvedValue([d1]);
      mockMemory.getAliases.mockResolvedValue({});

      const res = await service.converse({ prompt: 'apaga todo cocina', userId: 'u1' }, 'es');

      // "todo" is a bulk keyword → room bulk fast-path → confirmation
      expect(res.type).toBe('clarification');
      const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
      expect(saveCall?.pendingBulkAction?.bulkType).toBe('all');
    });
  });

  describe('Aliases are strictly literal user-defined (Fix 4)', () => {
    it('"office" does NOT resolve to any room without an explicit user alias', async () => {
      // Even though "Cuarto Master" may be considered the "office", no auto-translation occurs
      const room = createTestRoom({ id: 'r1', name: 'Cuarto Master' });
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockDeviceRepo.findAll.mockResolvedValue([]);
      // No aliases stored
      mockMemory.getAliases.mockResolvedValue({});

      const resolution = await (service as any).resolveRoomAlias(
        'office',
        [room],
        [],
        'u1',
        {} // empty aliases — "office" was never created by the user
      );

      expect(resolution.status).toBe('not_found');
    });

    it('"office" resolves after user creates alias "when i say office i mean Cuarto Master"', async () => {
      const room = createTestRoom({ id: 'r1', name: 'Cuarto Master' });
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockDeviceRepo.findAll.mockResolvedValue([]);

      // User has explicitly created the alias
      const userAliases = { 'office': 'r1' };
      mockMemory.getAliases.mockResolvedValue(userAliases);

      const resolution = await (service as any).resolveRoomAlias(
        'office',
        [room],
        [],
        'u1',
        userAliases
      );

      expect(resolution.status).toBe('resolved');
      expect(resolution.rooms[0].id).toBe('r1');
    });

    it('"cuando diga mi oficina me refiero a Cuarto Master" creates the alias correctly', async () => {
      const room = createTestRoom({ id: 'r1', name: 'Cuarto Master' });
      mockRoomRepo.findAll.mockResolvedValue([room]);
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockMemory.getAlias.mockResolvedValue(null);

      const res = await service.converse({
        prompt: 'cuando diga mi oficina me refiero a Cuarto Master',
        userId: 'u1'
      }, 'es');

      // Should store alias with room ID, not room name
      expect(res.type).toBe('answer');
      expect(mockMemory.setAlias).toHaveBeenCalledWith('u1', 'mi oficina', 'r1');
    });
  });
});
