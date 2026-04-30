import { AssistantConversationService } from '../application/AssistantConversationService';
import { 
  createMockAssistantMemory,
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAutomationRuleRepository,
  createTestDevice, 
  createTestRoom,
  createMockAssistantLearningService,
  createMockIntentInterpreterPort,
  createMockAssistantConfirmationPolicy,
  createMockSceneExecutionService,
  createMockDeviceCommandDispatcher,
  createMockAssistantSmallTalk,
  createMockFollowUpResolver,
  createMockAssistantDraftService,
  createMockSmartEntityResolver,
  createMockAssistantSuggestionService,
  createMockExecutionRecordRepository,
  createMockAssistantPlannerV2ShadowService
} from './test_helpers';

describe('Assistant Alias Management V1', () => {
  let service: AssistantConversationService;
  let mockMemory: any;
  let mockDeviceRepo: any;
  let mockRoomRepo: any;
  let mockSceneRepo: any;
  let mockAutomationRepo: any;
  let mockLearning: any;
  let mockShadow: any;

  beforeEach(() => {
    mockMemory = createMockAssistantMemory();
    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockSceneRepo = createMockSceneRepository();
    mockAutomationRepo = createMockAutomationRuleRepository();
    mockLearning = createMockAssistantLearningService();
    mockShadow = createMockAssistantPlannerV2ShadowService();

    service = new AssistantConversationService(
      createMockIntentInterpreterPort(),
      createMockAssistantConfirmationPolicy(),
      createMockSceneExecutionService(),
      createMockDeviceCommandDispatcher(),
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      createMockAssistantSmallTalk(),
      mockMemory,
      createMockFollowUpResolver(),
      createMockAssistantDraftService(),
      mockAutomationRepo,
      mockLearning,
      createMockSmartEntityResolver(),
      createMockAssistantSuggestionService(),
      createMockExecutionRecordRepository(),
      mockShadow
    );
  });

  it('1. list aliases resolves target names', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz Seccion Escritorio' })]);
    mockMemory.getAliases.mockResolvedValue({
      'mi oficina': 'r1',
      'luz lectura': 'd1'
    });

    const res = await service.converse({ prompt: 'qué aliases tengo', userId: 'u1' }, 'es');
    expect(res.message).toContain('mi oficina → Cuarto Master');
    expect(res.message).toContain('luz lectura → Luz Seccion Escritorio');
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('2. list aliases empty', async () => {
    mockMemory.getAliases.mockResolvedValue({});
    const res = await service.converse({ prompt: 'what aliases do i have', userId: 'u1' }, 'en');
    expect(res.message).toBe("You haven't created any aliases yet.");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('3. alias meaning found', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    
    const res = await service.converse({ prompt: 'qué significa mi oficina', userId: 'u1' }, 'es');
    expect(res.message).toBe("'mi oficina' se refiere a Cuarto Master.");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('4. alias meaning not found', async () => {
    mockMemory.getAliases.mockResolvedValue({});
    const res = await service.converse({ prompt: 'qué significa mi oficina', userId: 'u1' }, 'es');
    expect(res.message).toBe("No encontré ese alias.");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('5. delete request creates pendingAliasDelete and does not delete immediately', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    
    const res = await service.converse({ prompt: 'olvida mi oficina', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('clarification');
    expect(res.message).toBe("¿Quieres que olvide el alias 'mi oficina' para Cuarto Master?");
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingAliasDelete: expect.objectContaining({
        alias: 'mi oficina',
        targetId: 'r1',
        targetName: 'Cuarto Master'
      })
    }));
    expect(mockMemory.deleteAlias).not.toHaveBeenCalled();
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('6. delete confirm deletes alias', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue({
      pendingAliasDelete: { alias: 'mi oficina', targetId: 'r1', targetName: 'Cuarto Master', timestamp: new Date().toISOString() }
    });
    
    const res = await service.converse({ prompt: 'sí', userId: 'u1', selectedOptionId: 'confirm' }, 'es');
    
    expect(res.message).toBe("Listo, eliminé el alias 'mi oficina'.");
    expect(mockMemory.deleteAlias).toHaveBeenCalledWith('u1', 'mi oficina');
    // Verify it clears memory
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingAliasDelete: undefined
    }));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('7. delete reject keeps alias', async () => {
    mockMemory.getShortTermMemory.mockResolvedValue({
      pendingAliasDelete: { alias: 'mi oficina', targetId: 'r1', targetName: 'Cuarto Master', timestamp: new Date().toISOString() }
    });
    
    const res = await service.converse({ prompt: 'no', userId: 'u1', selectedOptionId: 'cancel' }, 'es');
    
    expect(res.message).toBe("Acción cancelada.");
    expect(mockMemory.deleteAlias).not.toHaveBeenCalled();
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('8. delete paths do not call shadowService.runShadow', async () => {
    // Already checked in 5, 6, 7
    expect(true).toBe(true);
  });

  it('9. creation collision with room name is rejected', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r2', name: 'Cocina' })]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    
    const res = await service.converse({ prompt: 'cuando diga cocina me refiero a cuarto master', userId: 'u1' }, 'es');
    
    expect(res.message).toContain("Ya existe una estancia o dispositivo llamado 'Cocina'");
    expect(mockMemory.setAlias).not.toHaveBeenCalled();
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('10. creation collision with device name is rejected', async () => {
    mockRoomRepo.findAll.mockResolvedValue([]);
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd2', name: 'Luz Entrada' })]);
    
    const res = await service.converse({ prompt: 'cuando diga luz entrada me refiero a lampara de pie', userId: 'u1' }, 'es');
    
    expect(res.message).toContain("Ya existe una estancia o dispositivo llamado 'Luz Entrada'");
    expect(mockMemory.setAlias).not.toHaveBeenCalled();
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('11. existing alias creation still works', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockDeviceRepo.findAll.mockResolvedValue([]);
    
    const res = await service.converse({ prompt: 'cuando diga oficinita me refiero a cuarto master', userId: 'u1' }, 'es');
    
    expect(res.message).toBe("Perfecto, ahora 'oficinita' se refiere a Cuarto Master.");
    expect(mockMemory.setAlias).toHaveBeenCalledWith('u1', 'oficinita', 'r1');
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('12. room bulk still resolves user alias after these changes', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz Techo', type: 'light', roomId: 'r1' })]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    
    const res = await service.converse({ prompt: 'apaga luces de mi oficina', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('clarification'); // Because it's "luces", which could be multiple, etc.
    expect(res.message).toContain("Cuarto Master");
  });
  it('13. natural phrase alias meaning works', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    
    const res = await service.converse({ prompt: 'qué significa mi oficina porfa', userId: 'u1' }, 'es');
    expect(res.message).toBe("'mi oficina' se refiere a Cuarto Master.");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('14. natural phrase delete request works', async () => {
    mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master' })]);
    mockMemory.getAliases.mockResolvedValue({ 'mi oficina': 'r1' });
    
    const res = await service.converse({ prompt: 'olvida mi oficina por favor', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('clarification');
    expect(res.message).toBe("¿Quieres que olvide el alias 'mi oficina' para Cuarto Master?");
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('u1', expect.objectContaining({
      pendingAliasDelete: expect.objectContaining({
        alias: 'mi oficina',
        targetId: 'r1',
        targetName: 'Cuarto Master'
      })
    }));
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('15. multiple aliases same length returns ambiguity', async () => {
    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Sala 1' }),
      createTestRoom({ id: 'r2', name: 'Sala 2' })
    ]);
    mockMemory.getAliases.mockResolvedValue({ 
      'mi sala': 'r1',
      'la sala': 'r2'
    });
    
    const res = await service.converse({ prompt: 'olvida mi sala la sala', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toContain("Encontré varios aliases posibles:");
    expect(res.message).toContain("mi sala");
    expect(res.message).toContain("la sala");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });

  it('16. delete not found logs not found', async () => {
    mockMemory.getAliases.mockResolvedValue({});
    
    const res = await service.converse({ prompt: 'olvida mi oficina fantasma', userId: 'u1' }, 'es');
    
    expect(res.type).toBe('answer');
    expect(res.message).toBe("No encontré ese alias.");
    expect(mockShadow.runShadow).not.toHaveBeenCalled();
  });
});
