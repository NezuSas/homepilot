import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { DiagnosticsErrorState } from '../components/DiagnosticsErrorState';
import { DiagnosticsHealthBanner } from '../components/DiagnosticsHealthBanner';
import { DiagnosticsIssuesList } from '../components/DiagnosticsIssuesList';
import { DiagnosticsLoadingState } from '../components/DiagnosticsLoadingState';
import { DiagnosticsProbeGrid } from '../components/DiagnosticsProbeGrid';
import { DiagnosticsResilienceSummary } from '../components/DiagnosticsResilienceSummary';
import { DiagnosticsTimeline } from '../components/DiagnosticsTimeline';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';

interface DiagnosticsCounters {
  recentReconnects: number;
  recentAutomationSuccess: number;
  recentAutomationFailures: number;
  recentReconciliations: number;
}

interface SystemIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
}

interface DiagnosticsSnapshot {
  overallStatus: 'healthy' | 'degraded' | 'offline';
  haConnectionStatus: string;
  websocketStatus: string;
  automationEngineStatus: string;
  reconciliationStatus: string;
  lastEventAt: string | null;
  lastReconnectAt: string | null;
  lastReconciliationAt: string | null;
  lastAutomationExecutionAt: string | null;
  systemTime: string;
  systemTimeLocal: string;
  systemTimezone: string;
  counters: DiagnosticsCounters;
  issues: SystemIssue[];
}

interface DiagnosticEvent {
  occurredAt: string;
  category: 'resilience' | 'automation' | 'auth' | 'command';
  eventType: string;
  description: string;
  data: Record<string, unknown>;
  correlationId?: string;
}

const TIMEZONE_VALUES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Caracas',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC'
];

export function DiagnosticsView() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [scenes, setScenes] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [updatingTz, setUpdatingTz] = useState(false);
  
  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);

  const user = JSON.parse(localStorage.getItem('hp_user_ctx') || '{}');
  const isAdmin = user.role === 'admin';

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchDiagnostics = async () => {
    try {
      const [snapshotRes, eventsRes, scenesRes, automationsRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/v1/system/diagnostics`),
        apiFetch(`${API_BASE_URL}/api/v1/system/diagnostics/events`),
        apiFetch(`${API_BASE_URL}/api/v1/scenes`),
        apiFetch(`${API_BASE_URL}/api/v1/automations`)
      ]);

      if (!snapshotRes.ok || !eventsRes.ok) throw new Error(t('common.errors.api_failed'));

      setSnapshot(await snapshotRes.json());
      setEvents(await eventsRes.json());
      if (scenesRes.ok) setScenes(await scenesRes.json());
      if (automationsRes.ok) setAutomations(await automationsRes.json());
      await refreshSnapshot();
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleTimezoneChange = async (newTz: string) => {
    setUpdatingTz(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/system/timezone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTz })
      });

      if (!res.ok) throw new Error(t('diagnostics.update_failed'));
      
      await fetchDiagnostics();
    } catch (err: unknown) {
      console.error('Timezone update failed:', err);
    } finally {
      setUpdatingTz(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !snapshot) {
    return <DiagnosticsLoadingState label={t('diagnostics.loading')} />;
  }

  if (error || !snapshot) {
    return (
      <DiagnosticsErrorState
        title={t('diagnostics.error_loading')}
        message={error || t('common.errors.unknown')}
      />
    );
  }

  // --- Helpers ---
  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString() : t('common.never');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

      <DiagnosticsResilienceSummary
        devices={devices}
        scenes={scenes}
        automations={automations}
      />
      
      <DiagnosticsHealthBanner
        status={snapshot.overallStatus}
        issueCount={snapshot.issues.length}
        systemTimeLocal={snapshot.systemTimeLocal}
        systemTimezone={snapshot.systemTimezone}
        lastEventAt={snapshot.lastEventAt}
        isAdmin={isAdmin}
        updatingTimezone={updatingTz}
        timezoneValues={TIMEZONE_VALUES}
        onTimezoneChange={handleTimezoneChange}
        formatTime={formatTime}
      />

      <DiagnosticsIssuesList issues={snapshot.issues} />

      <DiagnosticsProbeGrid
        haConnectionStatus={snapshot.haConnectionStatus}
        websocketStatus={snapshot.websocketStatus}
        automationEngineStatus={snapshot.automationEngineStatus}
        reconciliationStatus={snapshot.reconciliationStatus}
        lastReconnectAt={snapshot.lastReconnectAt}
        lastAutomationExecutionAt={snapshot.lastAutomationExecutionAt}
        lastReconciliationAt={snapshot.lastReconciliationAt}
        counters={snapshot.counters}
        formatTime={formatTime}
      />

      <DiagnosticsTimeline
        events={events}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
      />

    </div>
  );
}
