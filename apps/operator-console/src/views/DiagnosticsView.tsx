import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { DiagnosticsHealthBanner } from '../components/DiagnosticsHealthBanner';
import { DiagnosticsIssuesList } from '../components/DiagnosticsIssuesList';
import { LoadingState } from '../components/ui/LoadingState';
import { DiagnosticsProbeGrid } from '../components/DiagnosticsProbeGrid';
import { DiagnosticsResilienceSummary } from '../components/DiagnosticsResilienceSummary';
import { DiagnosticsTimeline } from '../components/DiagnosticsTimeline';
import { AlertBanner } from '../components/ui/AlertBanner';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { DatabaseBackupsCard, type DatabaseBackupSummary } from '../components/DatabaseBackupsCard';
import { fetchDiagnosticResource, isCancelledRequest, startSequentialPolling } from '../lib/diagnosticResourceRequests';

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

interface DiagnosticScene {
  id?: string;
  actions?: { deviceId: string }[];
}

interface DiagnosticAutomation {
  trigger?: {
    type?: string;
    deviceId?: string;
  };
  action?: {
    type?: string;
    targetDeviceId?: string;
    sceneId?: string;
  };
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
  const [scenes, setScenes] = useState<DiagnosticScene[]>([]);
  const [automations, setAutomations] = useState<DiagnosticAutomation[]>([]);
  const [updatingTz, setUpdatingTz] = useState(false);
  const [backups, setBackups] = useState<DatabaseBackupSummary[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsCreating, setBackupsCreating] = useState(false);
  const [backupsError, setBackupsError] = useState(false);
  
  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);

  const user = JSON.parse(localStorage.getItem('hp_user_ctx') || '{}');
  const isAdmin = user.role === 'admin';

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/system/backups`);
      if (!response.ok) throw new Error('BACKUP_LIST_ERROR');
      setBackups(await response.json() as DatabaseBackupSummary[]);
      setBackupsError(false);
    } catch {
      setBackupsError(true);
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  const createBackup = useCallback(async () => {
    setBackupsCreating(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/system/backups`, { method: 'POST' });
      if (!response.ok) throw new Error('BACKUP_CREATE_ERROR');
      const created = await response.json() as DatabaseBackupSummary;
      setBackups(previous => [created, ...previous.filter(backup => backup.filename !== created.filename)]);
      setBackupsError(false);
    } catch {
      setBackupsError(true);
    } finally {
      setBackupsCreating(false);
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [refreshVersion, setRefreshVersion] = useState(0);

  const handleTimezoneChange = async (newTz: string) => {
    setUpdatingTz(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/system/timezone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTz })
      });

      if (!res.ok) throw new Error(t('diagnostics.update_failed'));
      
      setRefreshVersion((version) => version + 1);
    } catch (err: unknown) {
      console.error('Timezone update failed:', err);
    } finally {
      setUpdatingTz(false);
    }
  };

  useEffect(() => {
    return startSequentialPolling(async (signal) => {
      try {
        const [snapshotRes, eventsRes, scenesRes, automationsRes] = await Promise.all([
          fetchDiagnosticResource(`${API_BASE_URL}/api/v1/system/diagnostics`, signal),
          fetchDiagnosticResource(`${API_BASE_URL}/api/v1/system/diagnostics/events`, signal),
          fetchDiagnosticResource(`${API_BASE_URL}/api/v1/scenes`, signal),
          fetchDiagnosticResource(`${API_BASE_URL}/api/v1/automations`, signal),
        ]);
        if (!snapshotRes.ok || !eventsRes.ok) throw new Error(t('common.errors.api_failed'));
        const [nextSnapshot, nextEvents, nextScenes, nextAutomations] = await Promise.all([
          snapshotRes.json(), eventsRes.json(),
          scenesRes.ok ? scenesRes.json() : null,
          automationsRes.ok ? automationsRes.json() : null,
        ]);
        if (signal.aborted) return;
        setSnapshot(nextSnapshot);
        setEvents(nextEvents);
        if (nextScenes) setScenes(nextScenes);
        if (nextAutomations) setAutomations(nextAutomations);
        void refreshSnapshot();
        setError(null);
      } catch (err: unknown) {
        if (!signal.aborted && !isCancelledRequest(err)) {
          setError(err instanceof Error ? err.message : t('common.errors.unknown'));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, 5000);
  }, [refreshSnapshot, refreshVersion, t]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadBackups();
  }, [isAdmin, loadBackups]);

  if (loading && !snapshot) {
    return <LoadingState label={t('diagnostics.loading')} className="h-64" size="md" />;
  }

  if (!snapshot) {
    return <AlertBanner variant="danger" title={t('diagnostics.error_loading')} message={error || t('common.errors.unknown')} />;
  }

  // --- Helpers ---
  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString() : t('common.never');

  return (
    <div className="space-y-6 pb-10 sm:space-y-8">

      {error && <AlertBanner variant="danger" title={t('diagnostics.error_loading')} message={error} />}

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

      {isAdmin && (
        <DatabaseBackupsCard
          backups={backups}
          isLoading={backupsLoading}
          isCreating={backupsCreating}
          hasError={backupsError}
          onCreate={() => void createBackup()}
          onRefresh={() => void loadBackups()}
        />
      )}

      <DiagnosticsTimeline
        events={events}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
      />

    </div>
  );
}
