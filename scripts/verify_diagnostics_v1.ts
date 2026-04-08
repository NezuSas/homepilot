import { DiagnosticsService } from '../packages/system-observability/application/DiagnosticsService';
import { HomeAssistantSettingsService } from '../packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import { ObservableRealtimeSyncStateProvider, ObservableAutomationEngineStateProvider } from '../packages/system-observability/domain/ObservableStateProviders';
import { ActivityLogRepository } from '../packages/devices/domain/repositories/ActivityLogRepository';

// --- Mocks ---
class MockSettingsService {
  public status: any = { configurationStatus: 'configured', connectivityStatus: 'reachable' };
  async getStatus() { return this.status; }
}

class MockRealtimeSyncProvider implements ObservableRealtimeSyncStateProvider {
  public state: any = { websocketStatus: 'connected', reconciliationStatus: 'idle', lastEventAt: null, lastReconnectAt: null, lastReconciliationAt: null };
  getObservableState() { return this.state; }
}

class MockAutomationEngineProvider implements ObservableAutomationEngineStateProvider {
  public state: any = { status: 'active', lastExecutionAt: null, totalSuccesses: 10, totalFailures: 0 };
  getObservableState() { return this.state; }
}

class MockActivityLogRepository {
  public logs: any[] = [];
  async findAllRecent(limit: number) { return this.logs.slice(0, limit); }
}

// --- Utils ---
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✅ ${message}`);
}

async function testHealthy() {
  console.log('\n--- Test 1: Healthy System ---');
  const service = new DiagnosticsService(
    new MockSettingsService() as any,
    new MockRealtimeSyncProvider() as any,
    new MockAutomationEngineProvider() as any,
    new MockActivityLogRepository() as any
  );
  const snap = await service.getSnapshot();
  assert(snap.overallStatus === 'healthy', 'overallStatus must be healthy');
  assert(snap.issues.length === 0, 'Must have 0 issues');
}

async function testOffline() {
  console.log('\n--- Test 2: Offline System ---');
  const settings = new MockSettingsService();
  settings.status.connectivityStatus = 'unreachable';

  const service = new DiagnosticsService(
    settings as any,
    new MockRealtimeSyncProvider() as any,
    new MockAutomationEngineProvider() as any,
    new MockActivityLogRepository() as any
  );
  const snap = await service.getSnapshot();
  assert(snap.overallStatus === 'offline', 'overallStatus must be offline');
  assert(snap.issues.some(i => i.code === 'HA_UNREACHABLE'), 'Must have HA_UNREACHABLE issue');
}

async function testDegradedReconnecting() {
  console.log('\n--- Test 3: Degraded System (Reconnecting) ---');
  const syncProvider = new MockRealtimeSyncProvider();
  syncProvider.state.websocketStatus = 'reconnecting';

  const service = new DiagnosticsService(
    new MockSettingsService() as any,
    syncProvider as any,
    new MockAutomationEngineProvider() as any,
    new MockActivityLogRepository() as any
  );
  const snap = await service.getSnapshot();
  assert(snap.overallStatus === 'degraded', 'overallStatus must be degraded');
  assert(snap.issues.some(i => i.code === 'WS_RECONNECTING'), 'Must have WS_RECONNECTING issue');
}

async function testDegradedIssueCombination() {
  console.log('\n--- Test 4: Degraded System (Automation Failures + Recent Reconnects) ---');
  
  const automation = new MockAutomationEngineProvider();
  automation.state.totalFailures = 2; // > 0 triggers AUTOMATION_FAILURES_PRESENT

  const logs = new MockActivityLogRepository();
  logs.logs = [
    { type: 'HA_RESILIENCE', data: { source: 'reconnect' } },
    { type: 'HA_RESILIENCE', data: { source: 'reconnect' } },
    { type: 'HA_RESILIENCE', data: { source: 'reconnect' } },
  ]; // 3 recent reconnects triggers RECENT_RECONNECTS

  const service = new DiagnosticsService(
    new MockSettingsService() as any,
    new MockRealtimeSyncProvider() as any,
    automation as any,
    logs as any
  );

  const snap = await service.getSnapshot();
  assert(snap.overallStatus === 'degraded', 'overallStatus must be degraded');
  assert(snap.issues.length === 2, 'Must have exactly 2 issues');
  assert(snap.issues.some(i => i.code === 'AUTOMATION_FAILURES_PRESENT'), 'Must have AUTOMATION_FAILURES_PRESENT issue');
  assert(snap.issues.some(i => i.code === 'RECENT_RECONNECTS'), 'Must have RECENT_RECONNECTS issue');
}

async function testTimelineFiltering() {
  console.log('\n--- Test 5: Timeline Event Filtering ---');
  
  const logs = new MockActivityLogRepository();
  logs.logs = [
    { type: 'STATE_CHANGED', timestamp: '2026-04-07T22:00:00Z', description: 'noise', data: {} },
    { type: 'HA_RESILIENCE', timestamp: '2026-04-07T22:01:00Z', description: 'reconnect ok', data: { source: 'reconnect' } },
    { type: 'COMMAND_DISPATCHED', timestamp: '2026-04-07T22:02:00Z', description: 'cmd ok', data: { status: 'success' } },
    { type: 'UNKNOWN_NOISE', timestamp: '2026-04-07T22:03:00Z', description: 'hmm', data: {} }
  ];

  const service = new DiagnosticsService(
    new MockSettingsService() as any,
    new MockRealtimeSyncProvider() as any,
    new MockAutomationEngineProvider() as any,
    logs as any
  );

  const events = await service.getRecentEvents();
  assert(events.length === 3, 'STATE_CHANGED events must be filtered out, others kept');
  
  const resilienceEv = events.find(e => e.category === 'resilience');
  assert(!!resilienceEv && resilienceEv.eventType === 'reconnect', 'Resilience event typed correctly');

  const ruleEv = events.find(e => e.category === 'automation');
  assert(!!ruleEv && ruleEv.eventType === 'automation_executed', 'Command Dispatch mapped to automation category');
  
  const unknownEv = events.find(e => e.eventType === 'UNKNOWN_NOISE');
  assert(!!unknownEv && unknownEv.category === 'command', 'Unknown elements fallback to command category');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Verificación Observability & Diagnostics V1 ===\n');

  try {
    await testHealthy();
    await testOffline();
    await testDegradedReconnecting();
    await testDegradedIssueCombination();
    await testTimelineFiltering();
  } catch (e: any) {
    console.error('\n🔴 Error inesperado en el runner:', e.message);
    process.exit(1);
  }

  console.log('\n=== Completado: todos los tests pasan ===\n');
}

main();
