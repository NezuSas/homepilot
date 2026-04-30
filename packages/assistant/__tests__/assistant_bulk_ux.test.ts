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
  createMockSceneExecutionService,
  createMockSystemVariableService
} from './test_helpers';

describe('Assistant Bulk Response UX', () => {
  let service: any; // Using any to access private method for testing or just test via converse
  let mockDeviceRepo: any;
  let mockSceneExecutionService: any;
  let mockMemory: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneExecutionService = createMockSceneExecutionService();
    mockMemory = createMockAssistantMemory();

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      mockSceneExecutionService,
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      createMockRoomRepository(),
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
      {} as any
    );
  });

  const setupConfirmationMemory = (ids: string[], command: string) => {
    mockMemory.getShortTermMemory.mockResolvedValue({
      lastQueryType: 'confirmation',
      entities: [],
      timestamp: new Date().toISOString(),
      pendingBulkAction: {
        type: 'bulk_action',
        deviceIds: ids,
        command,
        timestamp: new Date().toISOString(),
        originalPrompt: 'bulk prompt'
      }
    });
  };

  it('formats all-success bulk > 3 compact (Spanish)', async () => {
    const ids = ['d1', 'd2', 'd3', 'd4'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1' }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    setupConfirmationMemory(ids, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, encendí 4 luces correctamente.');
  });

  it('formats all-success bulk > 3 compact (English)', async () => {
    const ids = ['d1', 'd2', 'd3', 'd4'];
    const devices = ids.map(id => createTestDevice({ id, name: `Light ${id}`, homeId: 'h1' }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    setupConfirmationMemory(ids, 'turn_off');

    const res = await service.converse({ prompt: 'yes', userId: 'u1' }, 'en');

    expect(res.message).toBe('Done, turned off 4 lights successfully.');
  });

  it('lists device names briefly for small group <= 3', async () => {
    const ids = ['d1', 'd2'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1' }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    setupConfirmationMemory(ids, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, controlé Luz d1 y Luz d2 correctamente.');
  });

  it('formats partial failure listing only failed devices', async () => {
    const ids = ['d1', 'd2', 'd3'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1' }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    
    mockSceneExecutionService.execute.mockImplementation((scene: any) => {
      const deviceId = scene.actions[0].deviceId;
      if (deviceId === 'd2') {
        return Promise.resolve({ status: 'failed', actions: [{ status: 'failed', error: 'Offline' }] });
      }
      return Promise.resolve({ status: 'success', actions: [{ status: 'success' }] });
    });
    
    setupConfirmationMemory(ids, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toContain('Ejecuté 2 de 3 acciones correctamente.');
    expect(res.message).toContain('• Luz d2: Offline');
    expect(res.message).not.toContain('Luz d1');
    expect(res.message).not.toContain('Luz d3');
  });

  it('formats total failure as bullet list', async () => {
    const ids = ['d1', 'd2'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1' }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'failed', actions: [{ status: 'failed', error: 'Timeout' }] });
    setupConfirmationMemory(ids, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toContain('No pude ejecutar ninguna acción:');
    expect(res.message).toContain('• Luz d1: Timeout');
    expect(res.message).toContain('• Luz d2: Timeout');
  });
});
