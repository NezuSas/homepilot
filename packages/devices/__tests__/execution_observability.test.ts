import { SceneExecutionService } from '../application/SceneExecutionService';
import { InMemoryExecutionRecordRepository } from '../infrastructure/repositories/InMemoryExecutionRecordRepository';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { Scene } from '../domain/Scene';

describe('Execution Observability V1', () => {
  let executionRepo: InMemoryExecutionRecordRepository;
  let commandDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let service: SceneExecutionService;

  beforeEach(() => {
    executionRepo = new InMemoryExecutionRecordRepository();
    commandDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    service = new SceneExecutionService(commandDispatcher, executionRepo);
  });

  const mockScene: Scene = {
    id: 'scene-1',
    homeId: 'home-1',
    roomId: 'room-1',
    name: 'Test Scene',
    actions: [
      { deviceId: 'dev-1', command: 'turn_on' },
      { deviceId: 'dev-2', command: 'turn_off' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('guarda un ExecutionRecord cuando una escena se ejecuta con éxito', async () => {
    const result = await service.execute(mockScene, { sourceType: 'scene', sourceId: 'scene-1' });

    expect(result.status).toBe('success');
    
    const recent = await executionRepo.findRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0].sourceType).toBe('scene');
    expect(recent[0].sourceId).toBe('scene-1');
    expect(recent[0].status).toBe('success');
    expect(recent[0].actionCount).toBe(2);
    expect(recent[0].successCount).toBe(2);
    expect(recent[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('guarda un ExecutionRecord con status partial si algunas acciones fallan', async () => {
    commandDispatcher.dispatch
      .mockResolvedValueOnce(undefined) // dev-1 success
      .mockRejectedValueOnce(new Error('Driver failure')); // dev-2 fail

    const result = await service.execute(mockScene);

    expect(result.status).toBe('partial');
    
    const recent = await executionRepo.findRecent();
    expect(recent[0].status).toBe('partial');
    expect(recent[0].successCount).toBe(1);
    expect(recent[0].failedCount).toBe(1);
    expect(recent[0].actions[1].status).toBe('failed');
    expect(recent[0].actions[1].error).toBe('Driver failure');
  });

  it('soporta sourceType "automation" y persiste el sourceId (ruleId)', async () => {
    await service.execute(mockScene, { 
      sourceType: 'automation', 
      sourceId: 'rule-xyz',
      correlationId: 'auto-123' 
    });

    const recent = await executionRepo.findBySource('automation', 'rule-xyz');
    expect(recent).toHaveLength(1);
    expect(recent[0].correlationId).toBe('auto-123');
  });

  it('fallo en el repositorio no interrumpe la ejecución de la escena', async () => {
    jest.spyOn(executionRepo, 'save').mockRejectedValue(new Error('DB is full'));
    
    // Debería completar sin lanzar error
    const result = await service.execute(mockScene);
    
    expect(result.status).toBe('success');
    expect(commandDispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('findRecent ordena por startedAt desc', async () => {
    // Record 1
    await service.execute(mockScene);
    // Record 2 (más reciente)
    await new Promise(r => setTimeout(r, 10));
    await service.execute(mockScene);

    const recent = await executionRepo.findRecent(10);
    expect(recent).toHaveLength(2);
    const time1 = new Date(recent[0].startedAt).getTime();
    const time2 = new Date(recent[1].startedAt).getTime();
    expect(time1).toBeGreaterThan(time2);
  });

  describe('Retry V1', () => {
    it('findById recupera un registro específico', async () => {
      await service.execute(mockScene);
      const all = await executionRepo.findRecent();
      const id = all[0].id;

      const found = await executionRepo.findById(id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(id);
    });

    it('SceneExecutionService guarda el comando original para permitir reintentos', async () => {
      await service.execute(mockScene);
      const record = (await executionRepo.findRecent())[0];

      expect(record.actions[0].command).toBeDefined();
      expect(record.actions[0].commandName).toBe('turn_on');
      // @ts-ignore
      expect(record.actions[0].command.name).toBe('turn_on');
    });

    it('retry genera una nueva ejecución vinculada al origen', async () => {
      // 1. Ejecución fallida original
      commandDispatcher.dispatch.mockRejectedValueOnce(new Error('Fail'));
      await service.execute({ ...mockScene, actions: [mockScene.actions[0]] });
      
      const original = (await executionRepo.findRecent())[0];
      const failedAction = original.actions[0];
      expect(failedAction.status).toBe('failed');

      // 2. Simular retry (lógica que iría en el Route)
      const syntheticScene = {
        id: `retry-from-${original.id}`,
        name: `Retry: ${failedAction.commandName}`,
        homeId: 'system',
        roomId: null,
        actions: [{ deviceId: failedAction.deviceId, command: failedAction.command }]
      };

      commandDispatcher.dispatch.mockResolvedValueOnce(undefined);
      await service.execute(syntheticScene as any, {
        sourceType: 'manual',
        sourceId: `retry:${original.id}:0`
      });

      // 3. Verificar nuevo registro
      const all = await executionRepo.findRecent();
      expect(all).toHaveLength(2);
      expect(all[0].sourceId).toBe(`retry:${original.id}:0`);
      expect(all[0].status).toBe('success');
    });
  });
});
