import { ActivityRecord } from '../domain/repositories/ActivityLogRepository';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';

describe('Devices: State Infrastructure (ActivityLog)', () => {
  let repository: InMemoryActivityLogRepository;

  beforeEach(() => {
    repository = new InMemoryActivityLogRepository();
  });

  it('debe persistir registros y recuperarlos en orden LIFO (más reciente primero)', async () => {
    const record1: ActivityRecord = {
      timestamp: '2026-03-29T10:00:00Z',
      deviceId: 'dev-1',
      type: 'STATE_CHANGED',
      description: 'First update',
      data: { val: 1 }
    };

    const record2: ActivityRecord = {
      timestamp: '2026-03-29T11:00:00Z',
      deviceId: 'dev-1',
      type: 'STATE_CHANGED',
      description: 'Second update',
      data: { val: 2 }
    };

    await repository.saveActivity(record1);
    await repository.saveActivity(record2);

    const history = await repository.findRecentByDeviceId('dev-1', 10);

    expect(history).toHaveLength(2);
    expect(history[0].timestamp).toBe('2026-03-29T11:00:00Z'); // Record 2 es más reciente
    expect(history[1].timestamp).toBe('2026-03-29T10:00:00Z');
  });

  it('debe respetar el límite de resultados solicitado', async () => {
    // Insertamos 5 registros
    for (let i = 1; i <= 5; i++) {
      await repository.saveActivity({
        timestamp: `2026-03-29T10:00:0${i}Z`,
        deviceId: 'dev-limit',
        type: 'STATE_CHANGED',
        description: `Log ${i}`,
        data: { i }
      });
    }

    const history = await repository.findRecentByDeviceId('dev-limit', 3);
    expect(history).toHaveLength(3);
    expect(history[0].description).toBe('Log 5'); // Inserción unshift (LIFO)
  });

  it('debe retornar lista vacía si el dispositivo no tiene actividad', async () => {
    const history = await repository.findRecentByDeviceId('non-existent', 10);
    expect(history).toEqual([]);
  });
});
