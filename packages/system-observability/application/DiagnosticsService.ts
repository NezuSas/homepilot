import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantSettingsService } from '../../integrations/home-assistant/application/HomeAssistantSettingsService';
import { 
  ObservableAutomationEngineStateProvider, 
  ObservableRealtimeSyncStateProvider 
} from '../domain/ObservableStateProviders';
import { 
  DiagnosticEvent, 
  DiagnosticsSnapshot, 
  SystemIssue, 
  OverallStatus, 
  IssueCode,
  DiagnosticEventCategory
} from '../domain/SystemHealth';

export class DiagnosticsService {
  constructor(
    private readonly settingsService: HomeAssistantSettingsService,
    private readonly realtimeSyncProvider: ObservableRealtimeSyncStateProvider,
    private readonly automationEngineProvider: ObservableAutomationEngineStateProvider,
    private readonly activityLogRepository: ActivityLogRepository
  ) {}

  public async getSnapshot(): Promise<DiagnosticsSnapshot> {
    // 1. Fetch live status from providers
    const haSettings = await this.settingsService.getStatus();
    const syncState = this.realtimeSyncProvider.getObservableState();
    const engineState = this.automationEngineProvider.getObservableState();

    // 2. Fetch recent metrics from logs
    const recentLogs = await this.activityLogRepository.findAllRecent(100);
    
    // Compute counters
    let recentReconnects = 0;
    let recentReconciliations = 0;

    for (const log of recentLogs) {
      if (log.type === 'HA_RESILIENCE') {
        if (log.data?.source === 'reconnect') recentReconnects++;
        if (log.data?.source === 'reconciliation') recentReconciliations++;
      }
    }

    const counters = {
      recentReconnects,
      recentReconciliations,
      recentAutomationSuccess: engineState.totalSuccesses,
      recentAutomationFailures: engineState.totalFailures
    };

    // 3. Derive issues
    const issues: SystemIssue[] = [];

    if (haSettings.configurationStatus === 'not_configured') {
      issues.push({ code: 'HA_NOT_CONFIGURED', severity: 'critical', message: 'Home Assistant connection is not configured' });
    }
    
    if (haSettings.connectivityStatus === 'auth_error') {
      issues.push({ code: 'HA_AUTH_ERROR', severity: 'critical', message: 'Home Assistant authentication failed' });
    } else if (haSettings.connectivityStatus === 'unreachable') {
      issues.push({ code: 'HA_UNREACHABLE', severity: 'critical', message: 'Home Assistant is unreachable' });
    }

    if (syncState.websocketStatus === 'reconnecting') {
      issues.push({ code: 'WS_RECONNECTING', severity: 'warning', message: 'WebSocket is currently reconnecting' });
    }

    if (counters.recentReconnects >= 3) {
      issues.push({ code: 'RECENT_RECONNECTS', severity: 'warning', message: 'Frequent WebSocket reconnections detected' });
    }

    if (syncState.reconciliationStatus === 'failed') {
      issues.push({ code: 'RECONCILIATION_FAILED', severity: 'warning', message: 'Latest state reconciliation failed' });
    }

    if (counters.recentAutomationFailures >= 1) {
      issues.push({ code: 'AUTOMATION_FAILURES_PRESENT', severity: 'warning', message: 'Recent automation executions encountered errors' });
    }

    // 4. Derive overallStatus
    let overallStatus: OverallStatus = 'healthy';
    
    if (haSettings.connectivityStatus === 'unreachable' || haSettings.connectivityStatus === 'auth_error') {
      overallStatus = 'offline';
    } else if (
      syncState.websocketStatus === 'reconnecting' ||
      counters.recentReconnects >= 3 ||
      syncState.reconciliationStatus === 'failed' ||
      counters.recentAutomationFailures >= 1
    ) {
      overallStatus = 'degraded';
    }

    // Resolve nulls for optional types
    const haConnectionStatus = haSettings.connectivityStatus === 'unknown' ? (haSettings.configurationStatus === 'not_configured' ? 'not_configured' : 'unreachable') : haSettings.connectivityStatus;

    return {
      overallStatus,
      haConnectionStatus,
      websocketStatus: syncState.websocketStatus,
      automationEngineStatus: engineState.status,
      reconciliationStatus: syncState.reconciliationStatus,
      lastEventAt: syncState.lastEventAt,
      lastReconnectAt: syncState.lastReconnectAt,
      lastReconciliationAt: syncState.lastReconciliationAt,
      lastSuccessfulCommandAt: null, // Command persistence logic to be wired if needed
      lastAutomationExecutionAt: engineState.lastExecutionAt,
      counters,
      issues
    };
  }

  public async getRecentEvents(limit: number = 50): Promise<DiagnosticEvent[]> {
    // Bring more logs to filter out the noise
    const rawLogs = await this.activityLogRepository.findAllRecent(limit * 3);
    
    const events: DiagnosticEvent[] = [];

    for (const log of rawLogs) {
      if (events.length >= limit) break;

      // Filter out raw state changes that flood the timeline
      if (log.type === 'STATE_CHANGED') continue;

      let category: DiagnosticEventCategory = 'command';
      let eventType: string = log.type;

      if (log.type === 'HA_RESILIENCE') {
        category = 'resilience';
        eventType = (log.data?.source as string) || 'resilience_event';
      } else if (log.type === 'COMMAND_DISPATCHED' || log.type === 'AUTOMATION_FAILED') {
        category = 'automation';
        eventType = log.data?.status === 'error' ? 'automation_failed' : 'automation_executed';
      }

      events.push({
        occurredAt: log.timestamp,
        category,
        eventType,
        description: log.description,
        data: log.data || {}
      });
    }

    return events;
  }
}
