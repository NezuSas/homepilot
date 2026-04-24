import { randomUUID } from 'crypto';
import { Scene, SceneAction } from '../domain/Scene';
import { DeviceCommandRequest } from '../domain/commands';
import { 
  SceneActionResult, 
  SceneExecutionResult,
  ExecutionRecord,
} from '../domain/ExecutionRecord';
import { ExecutionRecordRepository } from '../domain/repositories/ExecutionRecordRepository';
import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';

/**
 * SceneExecutionOptions
 * Opciones para trazar el origen de la ejecución.
 */
export interface SceneExecutionOptions {
  sourceType: 'scene' | 'automation' | 'manual';
  sourceId: string;
  correlationId?: string;
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
  constructor(
    private readonly commandDispatcher: DeviceCommandDispatcherPort,
    private readonly executionRecordRepository?: ExecutionRecordRepository
  ) {}

  public async execute(scene: Scene, options?: SceneExecutionOptions): Promise<SceneExecutionResult> {
    const startedAt = new Date().toISOString();
    const startTimestamp = Date.now();

    const mode = scene.executionMode ?? 'parallel';
    let result: SceneExecutionResult;

    if (mode === 'sequential') {
      result = await this.executeSequential(scene);
    } else {
      result = await this.executeParallel(scene);
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTimestamp;

    if (this.executionRecordRepository) {
      this.saveExecutionRecord(scene, result, startedAt, completedAt, durationMs, options);
    }

    return result;
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

  /**
   * Persiste el registro de ejecución de forma asíncrona (fire-and-forget).
   */
  private saveExecutionRecord(
    scene: Scene,
    result: SceneExecutionResult,
    startedAt: string,
    completedAt: string,
    durationMs: number,
    options?: SceneExecutionOptions
  ): void {
    const sourceType = options?.sourceType ?? 'scene';
    const sourceId = options?.sourceId ?? scene.id;
    // Si no hay correlationId, generamos uno basado en el contexto
    const correlationId = options?.correlationId ?? `execution:${sourceType}:${sourceId}:${Date.now()}`;

    const record: ExecutionRecord = {
      id: randomUUID(),
      sourceType,
      sourceId,
      status: result.status,
      startedAt,
      completedAt,
      durationMs,
      actionCount: result.actions.length,
      successCount: result.actions.filter(a => a.status === 'success').length,
      failedCount: result.actions.filter(a => a.status === 'failed').length,
      skippedCount: result.actions.filter(a => a.status === 'skipped').length,
      correlationId,
      summary: `Scene "${scene.name}" executed via ${sourceType}. Status: ${result.status}`,
      actions: result.actions,
    };

    this.executionRecordRepository?.save(record).catch((err: any) => {
      console.warn('[SceneExecutionService] Failed to save execution record:', err.message);
    });
  }
}
