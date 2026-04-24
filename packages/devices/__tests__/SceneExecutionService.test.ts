import { SceneExecutionService } from '../application/SceneExecutionService';
import { Scene } from '../domain/Scene';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandRequest } from '../domain/commands';

// Helper: construye una escena mínima válida
function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    homeId: 'home-1',
    roomId: null,
    name: 'Test Scene',
    actions: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SceneExecutionService', () => {
  let dispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let service: SceneExecutionService;

  beforeEach(() => {
    dispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    service = new SceneExecutionService(dispatcher);
  });

  // ---------------------------------------------------------------------------
  // PARALLEL mode (default)
  // ---------------------------------------------------------------------------

  describe('Modo parallel (default / sin executionMode)', () => {
    it('escena sin executionMode usa parallel y llama dispatch por cada acción', async () => {
      const scene = makeScene({
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },
          { deviceId: 'dev-2', command: 'turn_off' },
        ],
      });

      const result = await service.execute(scene);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('success');
      expect(result.actions).toHaveLength(2);
      expect(result.actions.every(a => a.status === 'success')).toBe(true);
    });

    it('usa DeviceCommandService.dispatch para todas las acciones en parallel, no drivers directos', async () => {
      const scene = makeScene({
        executionMode: 'parallel',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },
          { deviceId: 'dev-2', command: 'open' },
        ],
      });

      await service.execute(scene);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
      // Verificar que se llama con metadata de escena inyectada
      const call0 = dispatcher.dispatch.mock.calls[0][1] as DeviceCommandRequest;
      expect(call0.metadata?.source).toBe('scene');
    });

    it('resultado partial cuando una acción falla en modo parallel', async () => {
      dispatcher.dispatch
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Device unreachable'));

      const scene = makeScene({
        executionMode: 'parallel',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },
          { deviceId: 'dev-2', command: 'turn_on' },
        ],
      });

      const result = await service.execute(scene);

      expect(result.status).toBe('partial');
      expect(result.actions[0].status).toBe('success');
      expect(result.actions[1].status).toBe('failed');
      expect(result.actions[1].error).toBe('Device unreachable');
    });

    it('resultado failed cuando todas las acciones fallan en modo parallel', async () => {
      dispatcher.dispatch.mockRejectedValue(new Error('offline'));

      const scene = makeScene({
        executionMode: 'parallel',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },
          { deviceId: 'dev-2', command: 'turn_on' },
        ],
      });

      const result = await service.execute(scene);

      expect(result.status).toBe('failed');
      expect(result.actions.every(a => a.status === 'failed')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // SEQUENTIAL mode
  // ---------------------------------------------------------------------------

  describe('Modo sequential', () => {
    it('escena con comando legacy turn_on funciona en modo sequential', async () => {
      const scene = makeScene({
        executionMode: 'sequential',
        actions: [{ deviceId: 'dev-1', command: 'turn_on' }],
      });

      const result = await service.execute(scene);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('success');
      expect(result.actions[0].commandName).toBe('turn_on');
      expect(result.actions[0].status).toBe('success');
    });

    it('escena con DeviceCommandRequest set_position funciona en modo sequential', async () => {
      const cmd: DeviceCommandRequest = {
        name: 'set_position',
        params: { position: 75 },
      };

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [{ deviceId: 'cover-1', command: cmd }],
      });

      const result = await service.execute(scene);

      expect(dispatcher.dispatch).toHaveBeenCalledWith('cover-1', expect.objectContaining({
        name: 'set_position',
        params: { position: 75 },
        metadata: expect.objectContaining({ source: 'scene' }),
      }));
      expect(result.actions[0].commandName).toBe('set_position');
      expect(result.actions[0].status).toBe('success');
    });

    it('si capability validation falla, la acción queda failed con el mensaje de error', async () => {
      dispatcher.dispatch.mockRejectedValueOnce(new Error('Comando turn_on no soportado para este dispositivo.'));

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'sensor-1', command: 'turn_on', continueOnFailure: true },
        ],
      });

      const result = await service.execute(scene);

      expect(result.actions[0].status).toBe('failed');
      expect(result.actions[0].error).toContain('no soportado');
    });

    it('continueOnFailure: true permite continuar tras fallo en sequential', async () => {
      dispatcher.dispatch
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(undefined);

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on', continueOnFailure: true },
          { deviceId: 'dev-2', command: 'turn_on' },
        ],
      });

      const result = await service.execute(scene);

      expect(result.actions[0].status).toBe('failed');
      expect(result.actions[1].status).toBe('success');
      expect(result.status).toBe('partial');
    });

    it('continueOnFailure: false (undefined) detiene y marca restantes como skipped', async () => {
      dispatcher.dispatch.mockRejectedValueOnce(new Error('offline'));

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },   // falla, no continueOnFailure
          { deviceId: 'dev-2', command: 'turn_off' },  // skipped
          { deviceId: 'dev-3', command: 'open' },      // skipped
        ],
      });

      const result = await service.execute(scene);

      expect(result.actions[0].status).toBe('failed');
      expect(result.actions[1].status).toBe('skipped');
      expect(result.actions[2].status).toBe('skipped');
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('delayMs solo en sequential — respeta el orden con timers', async () => {
      jest.useFakeTimers();

      dispatcher.dispatch.mockResolvedValue(undefined);

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on', delayMs: 500 },
          { deviceId: 'dev-2', command: 'turn_on', delayMs: 300 },
        ],
      });

      const executePromise = service.execute(scene);
      await jest.runAllTimersAsync();
      const result = await executePromise;

      jest.useRealTimers();

      expect(result.status).toBe('success');
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].deviceId).toBe('dev-1');
      expect(result.actions[1].deviceId).toBe('dev-2');
    });

    it('sequential respeta el orden estricto de ejecución', async () => {
      const order: string[] = [];
      dispatcher.dispatch.mockImplementation(async (deviceId: string) => {
        order.push(deviceId);
      });

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'first', command: 'turn_on' },
          { deviceId: 'second', command: 'turn_on' },
          { deviceId: 'third', command: 'turn_on' },
        ],
      });

      await service.execute(scene);

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('resultado success cuando todas las acciones pasan en sequential', async () => {
      const scene = makeScene({
        executionMode: 'sequential',
        actions: [
          { deviceId: 'dev-1', command: 'turn_on' },
          { deviceId: 'dev-2', command: 'close' },
        ],
      });

      const result = await service.execute(scene);

      expect(result.status).toBe('success');
      expect(result.sceneId).toBe('scene-1');
    });

    it('metadata de acción existente se complementa, correlationId propio se respeta', async () => {
      const cmd: DeviceCommandRequest = {
        name: 'turn_on',
        metadata: {
          userId: 'user-42',
          correlationId: 'my-own-id',
        },
      };

      const scene = makeScene({
        executionMode: 'sequential',
        actions: [{ deviceId: 'dev-1', command: cmd }],
      });

      await service.execute(scene);

      const dispatched = dispatcher.dispatch.mock.calls[0][1] as DeviceCommandRequest;
      expect(dispatched.metadata?.source).toBe('scene');
      expect(dispatched.metadata?.userId).toBe('user-42');
      expect(dispatched.metadata?.correlationId).toBe('my-own-id');
    });
  });
});
