import { DiagnosticsService } from '../application/DiagnosticsService';
import type { HomeAssistantSettingsService } from '../../integrations/home-assistant/application/HomeAssistantSettingsService';
import type { ActivityLogRepository, ActivityRecord } from '../../devices/domain/repositories/ActivityLogRepository';
import type { SystemVariableService } from '../../system-vars/application/SystemVariableService';
import type {
  ObservableAutomationEngineStateProvider,
  ObservableRealtimeSyncStateProvider,
} from '../domain/ObservableStateProviders';

function createService(options: {
  connectivityStatus?: 'reachable' | 'unreachable' | 'auth_error' | 'unknown';
  configurationStatus?: 'configured' | 'not_configured';
  logs?: ReadonlyArray<ActivityRecord>;
  websocketStatus?: 'connected' | 'reconnecting' | 'stopped';
  reconciliationStatus?: 'idle' | 'running' | 'failed';
  automationFailures?: number;
} = {}): DiagnosticsService {
  const settings = {
    getStatus: jest.fn().mockResolvedValue({
      configurationStatus: options.configurationStatus ?? 'configured',
      connectivityStatus: options.connectivityStatus ?? 'reachable',
      baseUrl: 'http://homeassistant.local',
      hasToken: true,
      maskedToken: '***',
      lastCheckedAt: null,
      activeSource: 'database',
    }),
  } as unknown as HomeAssistantSettingsService;
  const realtime: ObservableRealtimeSyncStateProvider = {
    getObservableState: () => ({
      websocketStatus: options.websocketStatus ?? 'connected',
      reconciliationStatus: options.reconciliationStatus ?? 'idle',
      lastEventAt: null,
      lastReconnectAt: null,
      lastReconciliationAt: null,
    }),
  };
  const automation: ObservableAutomationEngineStateProvider = {
    getObservableState: () => ({
      status: 'active',
      lastExecutionAt: null,
      totalSuccesses: 4,
      totalFailures: options.automationFailures ?? 0,
    }),
  };
  const activityLogRepository = {
    saveActivity: jest.fn(),
    findRecentByDeviceId: jest.fn(),
    findAllRecent: jest.fn().mockResolvedValue(options.logs ?? []),
    findAllByTypes: jest.fn(),
  } as unknown as ActivityLogRepository;
  const systemVariables = {
    getSystemTimezone: jest.fn().mockResolvedValue('America/Guayaquil'),
  } as unknown as SystemVariableService;

  return new DiagnosticsService(settings, realtime, automation, activityLogRepository, systemVariables);
}

const resilienceLog = (source: string): ActivityRecord => ({
  timestamp: '2026-08-11T10:00:00.000Z',
  deviceId: null,
  type: 'HA_RESILIENCE',
  description: `HA ${source}`,
  data: { source },
  correlationId: 'corr-1',
});

describe('Feature: system diagnostics', () => {
  it('Scenario: Given three recent reconnects When the snapshot is requested Then health is degraded and the reconnect issue is reported', async () => {
    const service = createService({ logs: [resilienceLog('reconnect'), resilienceLog('reconnect'), resilienceLog('reconnect')] });

    const snapshot = await service.getSnapshot();

    expect(snapshot.overallStatus).toBe('degraded');
    expect(snapshot.counters.recentReconnects).toBe(3);
    expect(snapshot.issues).toContainEqual({
      code: 'RECENT_RECONNECTS',
      severity: 'warning',
      message: 'diagnostics.messages.recent_reconnects',
    });
    expect(snapshot.systemTimezone).toBe('America/Guayaquil');
  });

  it('Scenario: Given a Home Assistant authentication failure When warnings are also present Then offline has priority and exposes a critical issue', async () => {
    const service = createService({ connectivityStatus: 'auth_error', websocketStatus: 'reconnecting', automationFailures: 1 });

    const snapshot = await service.getSnapshot();

    expect(snapshot.overallStatus).toBe('offline');
    expect(snapshot.issues).toEqual(expect.arrayContaining([
      { code: 'HA_AUTH_ERROR', severity: 'critical', message: 'diagnostics.messages.ha_auth_error' },
      { code: 'WS_RECONNECTING', severity: 'warning', message: 'diagnostics.messages.ws_reconnecting' },
      { code: 'AUTOMATION_FAILURES_PRESENT', severity: 'warning', message: 'diagnostics.messages.automation_failures' },
    ]));
  });

  it('Scenario: Given Home Assistant is not configured When the snapshot is requested Then it exposes the configuration issue without inventing an offline connection', async () => {
    const service = createService({ configurationStatus: 'not_configured', connectivityStatus: 'unknown' });

    const snapshot = await service.getSnapshot();

    expect(snapshot.overallStatus).toBe('healthy');
    expect(snapshot.haConnectionStatus).toBe('not_configured');
    expect(snapshot.issues).toContainEqual({
      code: 'HA_NOT_CONFIGURED',
      severity: 'critical',
      message: 'diagnostics.messages.ha_not_configured',
    });
  });

  it('Scenario: Given Home Assistant is unreachable When the snapshot is requested Then it is offline and reports the unreachable issue', async () => {
    const service = createService({ connectivityStatus: 'unreachable' });

    const snapshot = await service.getSnapshot();

    expect(snapshot.overallStatus).toBe('offline');
    expect(snapshot.issues).toContainEqual({
      code: 'HA_UNREACHABLE',
      severity: 'critical',
      message: 'diagnostics.messages.ha_unreachable',
    });
  });

  it('Scenario: Given reconciliation has failed When the snapshot is requested Then it is degraded and reports the reconciliation issue', async () => {
    const service = createService({ reconciliationStatus: 'failed' });

    const snapshot = await service.getSnapshot();

    expect(snapshot.overallStatus).toBe('degraded');
    expect(snapshot.issues).toContainEqual({
      code: 'RECONCILIATION_FAILED',
      severity: 'warning',
      message: 'diagnostics.messages.reconciliation_failed',
    });
  });

  it('Scenario: Given all observable sources are healthy When the snapshot is requested Then it reports healthy without active issues', async () => {
    const snapshot = await createService().getSnapshot();

    expect(snapshot.overallStatus).toBe('healthy');
    expect(snapshot.issues).toEqual([]);
  });

  it('Scenario: Given noisy raw state changes When recent events are requested Then noise is excluded and resilience events are normalized', async () => {
    const service = createService({
      logs: [
        { timestamp: '2026-08-11T10:03:00.000Z', deviceId: 'device-1', type: 'STATE_CHANGED', description: 'Raw state', data: {} },
        resilienceLog('reconciliation'),
        { timestamp: '2026-08-11T10:01:00.000Z', deviceId: 'device-2', type: 'AUTOMATION_EXECUTED', description: 'Automation failed', data: { status: 'error' }, correlationId: 'corr-2' },
      ],
    });

    await expect(service.getRecentEvents(2)).resolves.toEqual([
      expect.objectContaining({ category: 'resilience', eventType: 'RECONCILIATION_DONE' }),
      expect.objectContaining({ category: 'automation', eventType: 'AUTOMATION_FAILED', correlationId: 'corr-2' }),
    ]);
  });
});