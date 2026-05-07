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
  createMockSystemVariableService
} from './test_helpers';

describe('Assistant Bulk Refined Semantics', () => {
  let service: AssistantConversationService;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockMemory: any;
  let mockSceneExecution: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockMemory = createMockAssistantMemory();
    mockSceneExecution = createMockSceneExecutionService();

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      mockSceneExecution,
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      mockRoomRepo,
      createMockSceneRepository(),
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      createMockAutomationRuleRepository(),
      createMockAssistantLearningService(),
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      createMockSystemVariableService(),
      undefined
    );
  });

  const roomMaster = createTestRoom({ id: 'r-master', name: 'Cuarto Master' });
  const light1 = createTestDevice({ id: 'l1', name: 'Luz Techo', type: 'light', roomId: 'r-master' });
  const switchEscritorio = createTestDevice({ id: 's1', name: 'Escritorio', type: 'switch', roomId: 'r-master' });
  const coverWindow = createTestDevice({ id: 'c1', name: 'Persiana', type: 'cover', roomId: 'r-master' });
  const sensorMotion = createTestDevice({ id: 'sn1', name: 'Movimiento', type: 'sensor', roomId: 'r-master' });
  const unavailableDevice = createTestDevice({ id: 'u1', name: 'Roto', type: 'light', roomId: 'r-master', lastKnownState: { state: 'unavailable' } });

  it('includes switch named "Escritorio" in "apaga todo el cuarto master"', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([light1, switchEscritorio, coverWindow, sensorMotion, unavailableDevice]);
    mockRoomRepo.findAll.mockResolvedValue([roomMaster]);

    const res = await service.converse({ prompt: 'apaga todo el cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    // Should include light1 and switchEscritorio. 
    // Exclude cover (turn_off), sensor, and unavailable.
    expect(res.message).toContain('Encontré 2 dispositivos');
    expect(res.message).toContain('apagarlos');

    // Verify memory contains correct bulkType
    const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
    expect(saveCall.pendingBulkAction.bulkType).toBe('all');
    expect(saveCall.pendingBulkAction.deviceIds).toContain('l1');
    expect(saveCall.pendingBulkAction.deviceIds).toContain('s1');
    expect(saveCall.pendingBulkAction.deviceIds).not.toContain('c1');
    expect(saveCall.pendingBulkAction.deviceIds).not.toContain('sn1');
    expect(saveCall.pendingBulkAction.deviceIds).not.toContain('u1');
  });

  it('excludes switch named "Escritorio" in "apaga todas las luces del cuarto master"', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([light1, switchEscritorio, coverWindow, sensorMotion, unavailableDevice]);
    mockRoomRepo.findAll.mockResolvedValue([roomMaster]);

    const res = await service.converse({ prompt: 'apaga todas las luces del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    // Should include only light1.
    expect(res.message).toContain('Encontré 1 luces');
    expect(res.message).toContain('apagarlas');

    const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
    expect(saveCall.pendingBulkAction.bulkType).toBe('lights');
    expect(saveCall.pendingBulkAction.deviceIds).toContain('l1');
    expect(saveCall.pendingBulkAction.deviceIds).not.toContain('s1');
  });

  it('global "apaga todo" uses "dispositivos" terminology', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([light1, switchEscritorio]);
    
    const res = await service.converse({ prompt: 'apaga todo', userId: 'u1' }, 'es');

    expect(res.message).toContain('Encontré 2 dispositivos');
    const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
    expect(saveCall.pendingBulkAction.bulkType).toBe('all');
  });

  it('global "apaga todas las luces" uses "luces" terminology', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([light1, switchEscritorio]);
    
    const res = await service.converse({ prompt: 'apaga todas las luces', userId: 'u1' }, 'es');

    expect(res.message).toContain('Encontré 1 luces');
    const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
    expect(saveCall.pendingBulkAction.bulkType).toBe('lights');
  });

  it('execution summary uses "dispositivos" for bulkType "all"', async () => {
    const ids = ['l1', 's1', 'l2', 's2'];
    const devices = ids.map(id => createTestDevice({ id, name: `Device ${id}`, type: id.startsWith('l') ? 'light' : 'switch' }));
    
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecution.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ids,
        command: 'turn_off',
        bulkType: 'all',
        timestamp: new Date().toISOString(),
        originalPrompt: 'apaga todo'
      }
    });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, apagué 4 dispositivos correctamente.');
  });

  it('execution summary uses "luces" for bulkType "lights"', async () => {
    const ids = ['l1', 'l2', 'l3', 'l4'];
    const devices = ids.map(id => createTestDevice({ id, name: `Light ${id}`, type: 'light' }));
    
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecution.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ids,
        command: 'turn_off',
        bulkType: 'lights',
        timestamp: new Date().toISOString(),
        originalPrompt: 'apaga todas las luces'
      }
    });

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, apagué 4 luces correctamente.');
  });

  it('suggests candidate for high-confidence typo (prende lux sal)', async () => {
    const lightSala = createTestDevice({ id: 'l_sala', name: 'Luz Sala', type: 'light' });
    mockDeviceRepo.findAll.mockResolvedValue([lightSala]);
    
    const res = await service.converse({ prompt: 'prende lux sal', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain("¿Quisiste decir 'Luz Sala'?");
    expect(mockSceneExecution.execute).not.toHaveBeenCalled();
  });

  it('returns not found for low-confidence phrase (prende luz fantasma)', async () => {
    const lightSala = createTestDevice({ id: 'l_sala', name: 'Luz Sala', type: 'light' });
    mockDeviceRepo.findAll.mockResolvedValue([lightSala]);
    
    const res = await service.converse({ prompt: 'prende luz fantasma', userId: 'u1' }, 'es');

    expect(res.type).toBe('answer');
    expect(res.message).toContain("No encontré un dispositivo llamado");
    expect(mockSceneExecution.execute).not.toHaveBeenCalled();
  });

  it('does not infer primary light by display name in handleRoomSelectionForLight', async () => {
    // Both are lights. 'principal' previously was inferred. Now it must clarify.
    const principal = createTestDevice({ id: 'l_main', name: 'Luz Principal', type: 'light', roomId: 'r-master' });
    const normal = createTestDevice({ id: 'l_norm', name: 'Luz Secundaria', type: 'light', roomId: 'r-master' });
    
    mockDeviceRepo.findAll.mockResolvedValue([principal, normal]);
    mockRoomRepo.findAll.mockResolvedValue([roomMaster]);

    const mockIntentInterpreter = (service as any).intentInterpreter;
    mockIntentInterpreter.interpret.mockResolvedValue({ type: 'command', command: 'turn_off', deviceId: '', roomId: 'r-master', prompt: 'apaga la luz del cuarto master' });

    const res = await service.converse({ prompt: 'apaga la luz del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 2 luces');
    expect(res.message).toContain('cuál');
  });

  it('singular contextual light request (apaga la luz del cuarto master) is deterministic and non-bulk', async () => {
    // 1. One light exists -> Executes immediately
    const room = createTestRoom({ id: 'r-master', name: 'Cuarto Master' });
    const light = createTestDevice({ id: 'l1', name: 'Luz Techo', type: 'light', roomId: 'r-master', homeId: 'h1' });
    
    mockDeviceRepo.findAll.mockResolvedValue([light]);
    mockDeviceRepo.findDeviceById.mockResolvedValue(light);
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockRoomRepo.findRoomById.mockResolvedValue(room);
    mockSceneExecution.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });

    const res = await service.converse({ prompt: 'apaga la luz del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('execution');
    expect(res.message).toContain('Apagué Luz Techo');
    expect(mockSceneExecution.execute).toHaveBeenCalled();
  });

  it('singular contextual light request (apaga la luz del cuarto master) with multiple lights asks clarification', async () => {
    const room = createTestRoom({ id: 'r-master', name: 'Cuarto Master' });
    const l1 = createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light', roomId: 'r-master' });
    const l2 = createTestDevice({ id: 'l2', name: 'Luz 2', type: 'light', roomId: 'r-master' });
    
    mockDeviceRepo.findAll.mockResolvedValue([l1, l2]);
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockRoomRepo.findRoomById.mockResolvedValue(room);

    const res = await service.converse({ prompt: 'apaga la luz del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 2 luces en Cuarto Master');
    expect(res.message).toContain('cuál');
  });

  it('bulk lights request (apaga todas las luces del cuarto master) is correctly identified', async () => {
    const room = createTestRoom({ id: 'r-master', name: 'Cuarto Master' });
    const l1 = createTestDevice({ id: 'l1', name: 'Luz 1', type: 'light', roomId: 'r-master' });
    
    mockDeviceRepo.findAll.mockResolvedValue([l1]);
    mockRoomRepo.findAll.mockResolvedValue([room]);
    mockRoomRepo.findRoomById.mockResolvedValue(room);

    const res = await service.converse({ prompt: 'apaga todas las luces del cuarto master', userId: 'u1' }, 'es');

    expect(res.type).toBe('clarification');
    expect(res.message).toContain('Encontré 1 luces en Cuarto Master');
    const saveCall = mockMemory.saveShortTermMemory.mock.calls[0][1];
    expect(saveCall.pendingBulkAction.bulkType).toBe('lights');
  });

});
