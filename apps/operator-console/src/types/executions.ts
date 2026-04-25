/**
 * ExecutionRecord Types (Frontend)
 * Mirrors Backend domain for type-safe observability.
 */

export interface SceneActionResult {
  deviceId: string;
  commandName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
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
