import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import AutomationBuilderModal from './AutomationBuilderModal.tsx';
import { AutomationNotification } from '../components/AutomationNotification';
import { AutomationRuleCard } from '../components/AutomationRuleCard';
import { AutomationsEmptyState } from '../components/AutomationsEmptyState';
import { AutomationsHeader } from '../components/AutomationsHeader';
import { AutomationsLoadingState } from '../components/AutomationsLoadingState';
import ConfirmModal from '../components/ConfirmModal';
import { humanize } from '../lib/naming-utils';
import {
  AUTOMATION_FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  writeFavoriteIds,
} from '../lib/favorites';

interface AutomationRule {
  id: string;
  name: string;
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
  };
  action: {
    type: 'device_command' | 'execute_scene';
    targetDeviceId?: string;
    command?: string;
    sceneId?: string;
  };
}

interface Device {
  id: string;
  name: string;
  integrationSource?: string;
  updatedAt?: string;
}

interface Scene {
  id: string;
  name: string;
  actions?: { deviceId: string; command: string }[];
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const AutomationsView: React.FC = () => {
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
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteIds(AUTOMATION_FAVORITES_STORAGE_KEY));

  useEffect(() => {
    writeFavoriteIds(AUTOMATION_FAVORITES_STORAGE_KEY, favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchJSON = async (url: string, options?: RequestInit) => {
    const res = await apiFetch(url, options);
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
    setIsLoading(true);
    try {
      const [rulesData, devicesData, scenesData] = await Promise.all([
        fetchJSON(API_ENDPOINTS.automations.list),
        fetchJSON(API_ENDPOINTS.devices.list),
        fetchJSON(API_ENDPOINTS.scenes.list)
      ]);
      if (Array.isArray(rulesData)) setRules(rulesData);
      if (Array.isArray(devicesData)) setDevices(devicesData);
      if (Array.isArray(scenesData)) setScenes(scenesData);
      setError(null);
    } catch (error: unknown) {
      setError(getErrorMessage(error, t('common.errors.connection_error')));
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load only; interaction handlers update the local rule list afterwards.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchData(); }, []);

  const toggleRule = async (id: string, currentlyEnabled: boolean) => {
    if (processingId) return;
    setProcessingId(id);
    const action = currentlyEnabled ? 'disable' : 'enable';
    try {
      await fetchJSON(`${API_BASE_URL}/api/v1/automations/${id}/${action}`, { method: 'PATCH' });
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
      setRules(prev => prev.filter(r => r.id !== id));
      setFavoriteIds((current) => current.filter((favoriteId) => favoriteId !== id));
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

  const toggleFavorite = (ruleId: string) => {
    setFavoriteIds((current) => current.includes(ruleId)
      ? current.filter((favoriteId) => favoriteId !== ruleId)
      : [...current, ruleId]);
  };

  if (isLoading && rules.length === 0) {
    return <AutomationsLoadingState label={t('common.loading')} />;
  }

  const openEditAutomation = (rule: AutomationRule) => {
    setEditingAutomation(rule);
    setIsBuilderOpen(true);
  };

  return (
    <div className="flex flex-col gap-12 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <AutomationsHeader
        activeCount={rules.filter(r => r.enabled).length}
        onCreate={() => setIsBuilderOpen(true)}
      />

      {error && (
        <div className="p-6 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center gap-4 text-destructive animate-shake">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-black text-caption uppercase tracking-wider">{error}</p>
        </div>
      )}

      {rules.length === 0 ? (
        <AutomationsEmptyState onCreate={() => setIsBuilderOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rules.map((rule) => (
            <AutomationRuleCard
              key={rule.id}
              rule={rule}
              devices={devices}
              scenes={scenes}
              processingId={processingId}
              getDeviceName={getDeviceName}
              getSceneName={getSceneName}
              onToggle={toggleRule}
              onEdit={openEditAutomation}
              onDelete={setConfirmDeleteId}
              isFavorite={favoriteIds.includes(rule.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
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
