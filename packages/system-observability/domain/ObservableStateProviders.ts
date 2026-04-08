/**
 * ObservableStateProviders.ts
 *
 * Read-only port interfaces for observable state.
 * DiagnosticsService depends on these — NOT on concrete implementations.
 *
 * Concrete implementations (RealtimeSyncManager, AutomationEngine)
 * implement these in their respective modules.
 */

import { WebsocketStatus, ReconciliationStatus, AutomationEngineStatus } from './SystemHealth';

// ─── Realtime Sync Observable Port ────────────────────────────────────────────

export interface RealtimeSyncObservableState {
  readonly websocketStatus: WebsocketStatus;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly lastEventAt: string | null;
  readonly lastReconnectAt: string | null;
  readonly lastReconciliationAt: string | null;
}

/**
 * Port: Observable state from the realtime sync layer.
 * Implemented by HomeAssistantRealtimeSyncManager.
 */
export interface ObservableRealtimeSyncStateProvider {
  getObservableState(): RealtimeSyncObservableState;
}

// ─── Automation Engine Observable Port ────────────────────────────────────────

export interface AutomationEngineObservableState {
  readonly status: AutomationEngineStatus;
  readonly lastExecutionAt: string | null;
  readonly totalSuccesses: number;
  readonly totalFailures: number;
}

/**
 * Port: Observable state from the automation engine.
 * Implemented by AutomationEngine.
 */
export interface ObservableAutomationEngineStateProvider {
  getObservableState(): AutomationEngineObservableState;
}
