import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { fetchDiagnosticResource, invalidateDiagnosticCatalog } from '../lib/diagnosticResourceRequests';
import AutomationBuilderModal from './AutomationBuilderModal.tsx';
import { AutomationNotification } from '../components/AutomationNotification';
import { AutomationRuleCard } from '../components/AutomationRuleCard';
import { AutomationsEmptyState } from '../components/AutomationsEmptyState';
import { AutomationsHeader } from '../components/AutomationsHeader';
import { AutomationsSkeleton } from '../components/ui/ComponentSkeletons';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { humanize } from '../lib/naming-utils';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { useAutomationFavorites } from '../lib/useSceneFavorites';
import { isCameraDevice } from '../lib/deviceCapabilities';
import { RoutineCardGrid } from '../components/RoutineCardGrid';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { useMomentaryActionFeedback } from './dashboards/widgets/useMomentaryActionFeedback';
import { getSceneOrRoutineUrl, toAutomationEntityId } from './dashboards/widgets/sectionCardAssignments';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

interface AutomationRule {
  userId?: string;
  sharedUserIds?: string[];
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  trigger: {
    type: 'device_state_changed' | 'time';
    deviceId?: string;
    stateKey?: string;
    expectedValue?: string;
    time?: string;
    timeLocal?: string;
    timezone?: string;
    timeUTC?: string;
    days?: number[];
    dateLocal?: string;
  };
  action: {
    type: 'device_command' | 'execute_scene';
    targetDeviceId?: string;
    command?: string;
    sceneId?: string;
  };
}

type Device = SnapshotDevice;

interface Scene {
  id: string;
  name: string;
  actions?: { deviceId: string; command: string }[];
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const AutomationsView: React.FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const executing = useRef(false);
  const { actionFeedback, clearActionFeedback, showActionFeedback } = useMomentaryActionFeedback();
  const { favorites: favoriteIds, settled: favoritesSettled, toggleFavorite: persistFavorite } = useAutomationFavorites(currentUserId, rules.map((rule) => rule.id));
  const initialLoading = useInitialLoading(isLoading || !favoritesSettled);
  const [timerReference, setTimerReference] = useState(() => DateTime.now());
  const dataRequest = useRef<AbortController | null>(null);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const persistentRules = useMemo(() => rules.filter((rule) => !rule.trigger.dateLocal), [rules]);
  const activeTimers = useMemo(() => rules.flatMap((rule) => {
    if (!rule.enabled || rule.trigger.type !== 'time' || !rule.trigger.dateLocal || !rule.trigger.timeLocal) return [];
    const scheduledAt = DateTime.fromFormat(`${rule.trigger.dateLocal} ${rule.trigger.timeLocal}`, 'yyyy-MM-dd HH:mm', { zone: rule.trigger.timezone });
    if (!scheduledAt.isValid || scheduledAt.toMillis() <= timerReference.toMillis()) return [];
    return [{ rule, remainingMinutes: Math.max(1, Math.ceil(scheduledAt.diff(timerReference, 'minutes').minutes)) }];
  }).sort((left, right) => left.remainingMinutes - right.remainingMinutes), [rules, timerReference]);

  useEffect(() => {
    const interval = window.setInterval(() => setTimerReference(DateTime.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchJSON = async (url: string, options?: RequestInit) => {
    const res = options?.signal && (!options.method || options.method === 'GET')
      && (url === API_ENDPOINTS.automations.list || url === API_ENDPOINTS.scenes.list)
      ? await fetchDiagnosticResource(url, options.signal)
      : await apiFetch(url, options);
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type');
    if (!res.ok) {
      if (contentType && contentType.includes('application/json')) {
        const err = await res.json();
        throw new Error(err.message || `Server error: ${res.status}`);
      }
      throw new Error(`Server returned ${res.status} (${res.statusText})`);
    }
    if (!contentType || !contentType.includes('application/json')) return null;
    return res.json();
  };

  const fetchData = async () => {
    dataRequest.current?.abort();
    const controller = new AbortController();
    dataRequest.current = controller;
    setIsLoading(true);
    try {
      const [rulesData, scenesData] = await Promise.all([
        fetchJSON(API_ENDPOINTS.automations.list, { signal: controller.signal }),
        fetchJSON(API_ENDPOINTS.scenes.list, { signal: controller.signal }),
        refreshSnapshot(),
      ]);
      if (controller.signal.aborted) return;
      const snapshot = useDeviceSnapshotStore.getState();
      if (snapshot.lastUpdatedAt === null) throw new Error(t('common.errors.connection_error'));
      if (Array.isArray(rulesData)) setRules(rulesData);
      setDevices(snapshot.devices.filter((device) => !isCameraDevice(device)));
      if (Array.isArray(scenesData)) setScenes(scenesData);
      setError(null);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setError(getErrorMessage(error, t('common.errors.connection_error')));
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
      if (dataRequest.current === controller) dataRequest.current = null;
    }
  };

  // Initial load only; interaction handlers update the local rule list afterwards.
  useEffect(() => {
    void fetchData();
    return () => dataRequest.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial subscription; action handlers trigger later refreshes.
  }, []);

  const executeRule = async (id: string) => {
    if (executing.current) return;
    executing.current = true;
    setExecutingId(id);
    clearActionFeedback();
    try {
      await fetchJSON(getSceneOrRoutineUrl(toAutomationEntityId(id)), { method: 'POST' });
      setError(null);
      showActionFeedback(id, 'success');
    } catch (error: unknown) {
      setError(getErrorMessage(error, t('common.errors.operation_failed')));
      showActionFeedback(id, 'error');
    } finally {
      executing.current = false;
      setExecutingId(null);
    }
  };

  const toggleRule = async (id: string, currentlyEnabled: boolean) => {
    if (processingId) return;
    setProcessingId(id);
    const action = currentlyEnabled ? 'disable' : 'enable';
    try {
      await fetchJSON(`${API_BASE_URL}/api/v1/automations/${id}/${action}`, { method: 'PATCH' });
      invalidateDiagnosticCatalog();
      setRules(rules.map(r => r.id === id ? { ...r, enabled: !currentlyEnabled } : r));
    } catch (error: unknown) {
      setError(getErrorMessage(error, t('common.errors.operation_failed')));
    } finally {
      setProcessingId(null);
    }
  };

  const deleteRule = async (id: string) => {
    if (deletingId === id) return;
    setDeletingId(id);
    setIsDeleting(true);
    try {
      await fetchJSON(`${API_BASE_URL}/api/v1/automations/${id}`, { method: 'DELETE' });
      invalidateDiagnosticCatalog();
      setRules(prev => prev.filter(r => r.id !== id));
      if (favoriteIds.includes(id)) void persistFavorite(id);
      setConfirmDeleteId(null);
      setNotification({ message: t('automations.notifications.deleted'), type: 'success' });
    } catch (error: unknown) {
      setError(getErrorMessage(error, t('common.errors.operation_failed')));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const getDeviceName = (id?: string) => {
    const d = devices.find(dev => dev.id === id);
    return d ? humanize(d.id, d.name) : (id || t('common.unknown'));
  };
  const getSceneName = (id?: string) => scenes.find(s => s.id === id)?.name || id || t('common.unknown_scene');

  if (initialLoading) {
    return <AutomationsSkeleton label={t('common.loading')} />;
  }

  const openEditAutomation = (rule: AutomationRule) => {
    setEditingAutomation(rule);
    setIsBuilderOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-8 sm:gap-7">
      <AutomationsHeader
        activeCount={persistentRules.filter((rule) => rule.enabled).length}
        onCreate={() => setIsBuilderOpen(true)}
      />

      {error && <AlertBanner variant="danger" message={error} className="animate-shake" />}
      {activeTimers.length > 0 && (
        <section className="rounded-dashboard border border-primary/20 bg-card/70 p-5 shadow-depth-3 sm:p-6" aria-labelledby="active-timers-title">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Clock3 className="size-5" /></div><div><h2 id="active-timers-title" className="text-panel-title">{t('automations.timers.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('automations.timers.description')}</p></div></div>
            <span className="hp-type-control rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-primary">{t('automations.timers.pending_count', { count: activeTimers.length })}</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{activeTimers.map(({ rule, remainingMinutes }) => <article key={rule.id} className="flex flex-col gap-4 rounded-card border border-border/70 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-section-title">{rule.name}</p><p className="mt-1 text-sm text-muted-foreground">{remainingMinutes >= 60 ? t('automations.timers.remaining_hours', { count: Math.ceil(remainingMinutes / 60) }) : t('automations.timers.remaining_minutes', { count: remainingMinutes })}</p></div>{rule.userId === currentUserId && <Button type="button" variant="outline" size="sm" isLoading={processingId === rule.id} onClick={() => toggleRule(rule.id, true)} className="shrink-0 border-danger/30 text-danger hover:bg-danger/10">{t('automations.timers.cancel')}</Button>}</article>)}</div>
        </section>
      )}

      {persistentRules.length === 0 ? (
        <AutomationsEmptyState hasActiveTimers={activeTimers.length > 0} />
      ) : (
        <RoutineCardGrid>
          {persistentRules.map((rule) => (
            <AutomationRuleCard
              canManage={rule.userId === currentUserId}
              key={rule.id}
              rule={rule}
              processingId={processingId}
              isExecuting={executingId === rule.id}
              isExecutionBusy={executingId !== null}
              isSuccessful={actionFeedback?.id === rule.id && actionFeedback.status === 'success'}
              onExecute={executeRule}
              getDeviceName={getDeviceName}
              getSceneName={getSceneName}
              onToggle={toggleRule}
              onEdit={openEditAutomation}
              onDelete={setConfirmDeleteId}
              isFavorite={favoriteIds.includes(rule.id)}
              onToggleFavorite={(id) => { void persistFavorite(id); }}
            />
          ))}
        </RoutineCardGrid>
      )}

      {isBuilderOpen && (
        <AutomationBuilderModal 
          isOpen={isBuilderOpen}
          existingAutomation={editingAutomation}
          onClose={() => {
            setIsBuilderOpen(false);
            setEditingAutomation(null);
          }}
          onCreated={() => {
            setIsBuilderOpen(false);
            setEditingAutomation(null);
            fetchData();
            setNotification({ message: t('automations.notifications.updated'), type: 'success' });
          }}
          devices={devices}
          scenes={scenes}
        />
      )}

      {notification && (
        <AutomationNotification message={notification.message} />
      )}

      <ConfirmModal 
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && deleteRule(confirmDeleteId)}
        title={t('automations.delete_confirm_title')}
        description={t('automations.delete_confirm_description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isSubmitting={isDeleting}
      />
    </div>
  );
};

export default AutomationsView;
