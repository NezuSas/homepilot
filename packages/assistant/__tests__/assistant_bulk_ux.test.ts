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
  createMockSystemVariableService,
  createFakeConfirmationTicketRepository
} from './test_helpers';

describe('Assistant Bulk Response UX', () => {
  let service: any; // Using any to access private method for testing or just test via converse
  let mockDeviceRepo: any;
  let mockSceneExecutionService: any;
  let mockMemory: any;
  let mockConfirmationTicketRepository: any;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneExecutionService = createMockSceneExecutionService();
    mockMemory = createMockAssistantMemory();
    mockConfirmationTicketRepository = createFakeConfirmationTicketRepository();

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
      {} as any,
      undefined,
      undefined,
      undefined,
      mockConfirmationTicketRepository
    );
  });

  // Seeds a confirmable ticket for the given devices/command, and wires findAll so the
  // accept flow's scope revalidation sees the same devices the ticket was issued for.
  const setupConfirmation = async (devices: ReturnType<typeof createTestDevice>[], command: string) => {
    mockDeviceRepo.findAll.mockResolvedValue(devices);
    mockMemory.getShortTermMemory.mockResolvedValue({ lastQueryType: 'confirmation', entities: [], timestamp: new Date().toISOString() });
    await mockConfirmationTicketRepository.create({
      id: `ticket-${devices.map(d => d.id).join('-')}`,
      userId: 'u1',
      homeId: devices[0]?.homeId || 'h1',
      command,
      bulkType: 'lights',
      deviceIds: devices.map(d => d.id),
      originalPrompt: 'bulk prompt',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      consumedAt: null
    });
  };

  it('formats all-success bulk > 3 compact (Spanish)', async () => {
    const ids = ['d1', 'd2', 'd3', 'd4'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1', lastKnownState: { on: false } }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    await setupConfirmation(devices, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, encendí 4 luces correctamente.');
  });

  it('formats all-success bulk > 3 compact (English)', async () => {
    const ids = ['d1', 'd2', 'd3', 'd4'];
    const devices = ids.map(id => createTestDevice({ id, name: `Light ${id}`, homeId: 'h1', lastKnownState: { on: true } }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    await setupConfirmation(devices, 'turn_off');

    const res = await service.converse({ prompt: 'yes', userId: 'u1' }, 'en');

    expect(res.message).toBe('Done, turned off 4 lights successfully.');
  });

  it('lists device names briefly for small group <= 3', async () => {
    const ids = ['d1', 'd2'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1', lastKnownState: { on: false } }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'success', actions: [{ status: 'success' }] });
    await setupConfirmation(devices, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toBe('Listo, controlé Luz d1 y Luz d2 correctamente.');
  });

  it('formats partial failure listing only failed devices', async () => {
    const ids = ['d1', 'd2', 'd3'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1', lastKnownState: { on: false } }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));

    mockSceneExecutionService.execute.mockImplementation((scene: any) => {
      const deviceId = scene.actions[0].deviceId;
      if (deviceId === 'd2') {
        return Promise.resolve({ status: 'failed', actions: [{ status: 'failed', error: 'Offline' }] });
      }
      return Promise.resolve({ status: 'success', actions: [{ status: 'success' }] });
    });

    await setupConfirmation(devices, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toContain('Ejecuté 2 de 3 acciones correctamente.');
    expect(res.message).toContain('• Luz d2: Offline');
    expect(res.message).not.toContain('Luz d1');
    expect(res.message).not.toContain('Luz d3');
    // A mix of success and failure must be 'partial', not 'failed' — otherwise the
    // UI shows the red "could not complete" pill for a run that mostly succeeded.
    expect(res.execution?.status).toBe('partial');
  });

  it('formats total failure as bullet list', async () => {
    const ids = ['d1', 'd2'];
    const devices = ids.map(id => createTestDevice({ id, name: `Luz ${id}`, homeId: 'h1', lastKnownState: { on: false } }));
    mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(devices.find(d => d.id === id)));
    mockSceneExecutionService.execute.mockResolvedValue({ status: 'failed', actions: [{ status: 'failed', error: 'Timeout' }] });
    await setupConfirmation(devices, 'turn_on');

    const res = await service.converse({ prompt: 'sí', userId: 'u1' }, 'es');

    expect(res.message).toContain('No pude ejecutar ninguna acción:');
    expect(res.message).toContain('• Luz d1: Timeout');
    expect(res.message).toContain('• Luz d2: Timeout');
    expect(res.execution?.status).toBe('failed');
  });
});
