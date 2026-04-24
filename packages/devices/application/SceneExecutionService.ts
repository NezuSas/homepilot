import { Scene, SceneAction } from '../domain/Scene';
import { DeviceCommandRequest } from '../domain/commands';
import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';

/**
 * SceneActionResult
 * Resultado normalizado por cada acción ejecutada en una escena.
 */
export interface SceneActionResult {
  deviceId: string;
  commandName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

/**
 * SceneExecutionResult
 * Resultado consolidado de la ejecución completa de una escena.
 */
export interface SceneExecutionResult {
  sceneId: string;
  status: 'success' | 'partial' | 'failed';
  actions: SceneActionResult[];
}

/**
 * Normaliza una SceneAction.command al formato DeviceCommandRequest,
 * inyectando metadata de contexto de escena sin sobreescribir campos existentes.
 */
function normalizeCommand(
  action: SceneAction,
  sceneId: string,
  actionIndex: number
): DeviceCommandRequest {
  const sceneCorrelationId = `scene:${sceneId}:${actionIndex}`;

  if (typeof action.command === 'string') {
    return {
      name: action.command,
      metadata: {
        source: 'scene',
        correlationId: sceneCorrelationId,
      },
    };
  }

  // DeviceCommandRequest: complementar metadata sin sobrescribir campos existentes
  const existingMeta = action.command.metadata ?? {};
  return {
    ...action.command,
    metadata: {
      source: 'scene',
      ...existingMeta,
      // correlationId de escena prevalece si la acción no tenía uno propio
      correlationId: existingMeta.correlationId ?? sceneCorrelationId,
    },
  };
}

/**
 * Helper para respetar delayMs entre acciones en modo sequential.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SceneExecutionService
 *
 * Orquesta la ejecución de escenas usando DeviceCommandService.dispatch como flujo oficial.
 * Soporta dos modos de ejecución:
 * - "parallel" (default): lanza todas las acciones simultáneamente. Compatible con escenas antiguas.
 * - "sequential": ejecuta acciones en orden estricto, respetando delayMs y continueOnFailure.
 */
export class SceneExecutionService {
  constructor(private readonly commandDispatcher: DeviceCommandDispatcherPort) {}

  public async execute(scene: Scene): Promise<SceneExecutionResult> {
    const mode = scene.executionMode ?? 'parallel';

    if (mode === 'sequential') {
      return this.executeSequential(scene);
    }

    return this.executeParallel(scene);
  }

  /**
   * Modo parallel: lanza todas las acciones simultáneamente.
   * continueOnFailure y delayMs son ignorados (no aplican en parallel).
   * Usa DeviceCommandService.dispatch para cada acción.
   */
  private async executeParallel(scene: Scene): Promise<SceneExecutionResult> {
    const settled = await Promise.allSettled(
      scene.actions.map((action, idx) => {
        const command = normalizeCommand(action, scene.id, idx);
        return this.commandDispatcher.dispatch(action.deviceId, command);
      })
    );

    const actionResults: SceneActionResult[] = settled.map((result, idx) => {
      const action = scene.actions[idx];
      const commandName =
        typeof action.command === 'string' ? action.command : action.command.name;

      if (result.status === 'fulfilled') {
        return { deviceId: action.deviceId, commandName, status: 'success' as const };
      }

      return {
        deviceId: action.deviceId,
        commandName,
        status: 'failed' as const,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    return this.buildResult(scene.id, actionResults);
  }

  /**
   * Modo sequential: ejecuta acciones en orden estricto.
   * Respeta delayMs y continueOnFailure.
   * Si una acción falla y continueOnFailure !== true, las restantes quedan como "skipped".
   */
  private async executeSequential(scene: Scene): Promise<SceneExecutionResult> {
    const actionResults: SceneActionResult[] = [];
    let aborted = false;

    for (let idx = 0; idx < scene.actions.length; idx++) {
      const action = scene.actions[idx];
      const commandName =
        typeof action.command === 'string' ? action.command : action.command.name;

      if (aborted) {
        actionResults.push({ deviceId: action.deviceId, commandName, status: 'skipped' });
        continue;
      }

      if (action.delayMs && action.delayMs > 0) {
        await sleep(action.delayMs);
      }

      try {
        const command = normalizeCommand(action, scene.id, idx);
        await this.commandDispatcher.dispatch(action.deviceId, command);
        actionResults.push({ deviceId: action.deviceId, commandName, status: 'success' });
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        actionResults.push({ deviceId: action.deviceId, commandName, status: 'failed', error });

        if (!action.continueOnFailure) {
          aborted = true;
        }
      }
    }

    return this.buildResult(scene.id, actionResults);
  }

  /**
   * Determina el status global de la ejecución.
   * - success: todas las acciones pasaron
   * - failed: ninguna pasó (o hubo al menos una, pero skipped no cuenta como éxito)
   * - partial: hubo al menos una exitosa y al menos una fallida/skipped
   */
  private buildResult(sceneId: string, actions: SceneActionResult[]): SceneExecutionResult {
    const successCount = actions.filter(a => a.status === 'success').length;
    const failedCount = actions.filter(a => a.status === 'failed').length;
    const total = actions.length;

    let status: SceneExecutionResult['status'];

    if (successCount === total) {
      status = 'success';
    } else if (successCount === 0 && failedCount > 0) {
      status = 'failed';
    } else {
      status = 'partial';
    }

    return { sceneId, status, actions };
  }
}
