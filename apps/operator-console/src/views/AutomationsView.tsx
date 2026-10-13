import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
import { invalidateDiagnosticCatalog } from '../lib/diagnosticResourceRequests';
import AutomationBuilderModal from './AutomationBuilderModal.tsx';
import { getActiveTimers, getErrorMessage, type AutomationRule, type AutomationScene } from './automationsModel';
import { fetchAutomationJson } from './automationsRequests';
import { AutomationActiveTimers } from '../components/AutomationActiveTimers';
import { AutomationNotification } from '../components/AutomationNotification';
import { AutomationRuleCard } from '../components/AutomationRuleCard';
import { AutomationsEmptyState } from '../components/AutomationsEmptyState';
import { AutomationsHeader } from '../components/AutomationsHeader';
import { AutomationsSkeleton } from '../components/ui/ComponentSkeletons';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { humanize } from '../lib/naming-utils';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { useAutomationFavorites } from '../lib/useSceneFavorites';
import { isCameraDevice } from '../lib/deviceCapabilities';
import { RoutineCardGrid } from '../components/RoutineCardGrid';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { useMomentaryActionFeedback } from './dashboards/widgets/useMomentaryActionFeedback';
import { getSceneOrRoutineUrl, toAutomationEntityId } from './dashboards/widgets/sectionCardAssignments';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

type Device = SnapshotDevice;

const AutomationsView: React.FC<{ currentUserId: string | null }> = ({ currentUserId }) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scenes, setScenes] = useState<AutomationScene[]>([]);
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
  const activeTimers = useMemo(() => getActiveTimers(rules, timerReference), [rules, timerReference]);

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

  const fetchData = async () => {
    dataRequest.current?.abort();
    const controller = new AbortController();
    dataRequest.current = controller;
    setIsLoading(true);
    try {
      const [rulesData, scenesData] = await Promise.all([
        fetchAutomationJson(API_ENDPOINTS.automations.list, { signal: controller.signal }),
        fetchAutomationJson(API_ENDPOINTS.scenes.list, { signal: controller.signal }),
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
      await fetchAutomationJson(getSceneOrRoutineUrl(toAutomationEntityId(id)), { method: 'POST' });
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
      await fetchAutomationJson(`${API_BASE_URL}/api/v1/automations/${id}/${action}`, { method: 'PATCH' });
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
      await fetchAutomationJson(`${API_BASE_URL}/api/v1/automations/${id}`, { method: 'DELETE' });
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
        totalCount={persistentRules.length}
        onCreate={() => setIsBuilderOpen(true)}
      />

      {error && <AlertBanner variant="danger" message={error} className="animate-shake" />}
      {activeTimers.length > 0 && (
        <AutomationActiveTimers
          timers={activeTimers}
          currentUserId={currentUserId}
          processingId={processingId}
          onCancel={(id) => toggleRule(id, true)}
        />
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
