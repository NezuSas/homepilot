/**
 * ExecutionRecord Types (Frontend)
 * Mirrors Backend domain for type-safe observability.
 */

export type DeviceCommandV1 = "turn_on" | "turn_off" | "toggle" | "open" | "close" | "stop" | "set_position";

export interface DeviceCommandRequest {
  name: DeviceCommandV1;
  params?: Record<string, unknown>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

export interface SceneActionResult {
  deviceId: string;
  commandName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  command?: DeviceCommandV1 | DeviceCommandRequest;
  userMessage?: string;
  technicalMessage?: string;
  severity?: 'info' | 'warning' | 'critical';
  suggestedAction?: string;
}

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

export interface SceneExecutionResult {
  sceneId: string;
  status: 'success' | 'partial' | 'failed';
  actions: SceneActionResult[];
}
