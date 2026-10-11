import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { DiagnosticsHealthBanner } from '../components/DiagnosticsHealthBanner';
import { DiagnosticsIssuesList } from '../components/DiagnosticsIssuesList';
import { DiagnosticsSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { DiagnosticsProbeGrid } from '../components/DiagnosticsProbeGrid';
import { DiagnosticsResilienceSummary } from '../components/DiagnosticsResilienceSummary';
import { DiagnosticsTimeline } from '../components/DiagnosticsTimeline';
import { AlertBanner } from '../components/ui/AlertBanner';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { DatabaseBackupsCard } from '../components/DatabaseBackupsCard';
import { fetchDiagnosticResource, isCancelledRequest, startSequentialPolling } from '../lib/diagnosticResourceRequests';
import { useDatabaseBackups } from '../lib/useDatabaseBackups';
import {
  TIMEZONE_VALUES,
  isAdminUserContext,
  type DiagnosticAutomation,
  type DiagnosticEvent,
  type DiagnosticScene,
  type DiagnosticsSnapshot,
} from './diagnosticsModel';

export function DiagnosticsView() {
  const { t, i18n } = useTranslation();
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [scenes, setScenes] = useState<DiagnosticScene[]>([]);
  const [automations, setAutomations] = useState<DiagnosticAutomation[]>([]);
  const [updatingTz, setUpdatingTz] = useState(false);

  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);

  const isAdmin = isAdminUserContext(localStorage.getItem('hp_user_ctx'));
  const { backups, loading: backupsLoading, creating: backupsCreating, hasError: backupsError, settled: backupsSettled, load: loadBackups, create: createBackup } = useDatabaseBackups(isAdmin);
  const initialLoading = useInitialLoading(loading || (isAdmin && !backupsSettled));

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
        await refreshSnapshot();
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

  if (initialLoading) {
    return <DiagnosticsSkeleton label={t('diagnostics.loading')} isAdmin={isAdmin} />;
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
          locale={i18n.language}
          labels={{
            title: t('diagnostics.backups.title'),
            description: t('diagnostics.backups.description'),
            refresh: t('diagnostics.backups.refresh'),
            available: t('diagnostics.backups.available'),
            latest: t('diagnostics.backups.latest'),
            never: t('common.never'),
            loadFailed: t('diagnostics.backups.load_failed'),
            empty: t('diagnostics.backups.empty'),
            create: t('diagnostics.backups.create'),
            creating: t('diagnostics.backups.creating'),
            note: t('diagnostics.backups.note'),
          }}
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
