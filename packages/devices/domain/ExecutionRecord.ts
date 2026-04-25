import { DeviceCommandV1, DeviceCommandRequest } from './commands';

/**
 * SceneActionResult
 * Resultado normalizado por cada acción ejecutada en una escena.
 */
export interface SceneActionResult {
  deviceId: string;
  commandName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  command?: DeviceCommandV1 | DeviceCommandRequest;
  userMessage?: string;
  technicalMessage?: string;
  severity?: "info" | "warning" | "critical";
  suggestedAction?: string;
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
 * ExecutionRecord
 * Registro persistente de la ejecución de una escena o automatización.
 */
export interface ExecutionRecord {
  id: string;
  sourceType: 'scene' | 'automation' | 'manual';
  sourceId: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  actionCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  correlationId?: string;
  summary?: string;
  actions: SceneActionResult[];
}
