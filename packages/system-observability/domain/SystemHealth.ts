/**
 * SystemHealth.ts
 *
 * Domain types for Observability & Diagnostics V1.
 * All observability contracts are defined here — no logic, only shapes.
 */

export type OverallStatus = 'healthy' | 'degraded' | 'offline';
export type HaConnectionStatus = 'reachable' | 'unreachable' | 'auth_error' | 'not_configured';
export type WebsocketStatus = 'connected' | 'reconnecting' | 'stopped';
export type AutomationEngineStatus = 'active' | 'idle' | 'error';
export type ReconciliationStatus = 'idle' | 'running' | 'failed';

export type IssueCode =
  | 'HA_NOT_CONFIGURED'
  | 'HA_AUTH_ERROR'
  | 'HA_UNREACHABLE'
  | 'WS_RECONNECTING'
  | 'RECENT_RECONNECTS'
  | 'RECONCILIATION_FAILED'
  | 'AUTOMATION_FAILURES_PRESENT';

export type IssueSeverity = 'warning' | 'critical';

export interface SystemIssue {
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  readonly message: string;
}

export interface DiagnosticsCounters {
  readonly recentReconnects: number;
  readonly recentAutomationSuccess: number;
  readonly recentAutomationFailures: number;
  readonly recentReconciliations: number;
}

/**
 * Full diagnostics snapshot — returned by GET /api/v1/system/diagnostics.
 */
export interface DiagnosticsSnapshot {
  readonly overallStatus: OverallStatus;
  readonly haConnectionStatus: HaConnectionStatus;
  readonly websocketStatus: WebsocketStatus;
  readonly automationEngineStatus: AutomationEngineStatus;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly lastEventAt: string | null;
  readonly lastReconnectAt: string | null;
  readonly lastReconciliationAt: string | null;
  readonly lastSuccessfulCommandAt: string | null;
  readonly lastAutomationExecutionAt: string | null;
  readonly counters: DiagnosticsCounters;
  readonly issues: ReadonlyArray<SystemIssue>;
}

export type DiagnosticEventCategory = 'resilience' | 'automation' | 'auth' | 'command';

/**
 * Filtered operational event — returned by GET /api/v1/system/diagnostics/events.
 */
export interface DiagnosticEvent {
  readonly occurredAt: string;
  readonly category: DiagnosticEventCategory;
  readonly eventType: string;
  readonly description: string;
  readonly data: Record<string, unknown>;
  readonly correlationId?: string;
}
