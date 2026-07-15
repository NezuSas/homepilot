import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { DashboardAtmosphereRipple } from '../components/DashboardAtmosphereRipple';
import {
  DashboardAutomationsSection,
  type DashboardAutomation,
} from '../components/DashboardAutomationsSection';
import { DashboardInsightsSection } from '../components/DashboardInsightsSection';
import { DashboardLoadingState } from '../components/DashboardLoadingState';
import { DashboardScenesSection } from '../components/DashboardScenesSection';
import { HomeClimateSummary } from '../components/HomeClimateSummary';
import { API_BASE_URL } from '../config';
import {
  AUTOMATION_FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  SCENE_FAVORITES_STORAGE_KEY,
} from '../lib/favorites';
import { apiFetch } from '../lib/apiClient';
import type { View } from '../types';
import { useAssistantStore } from '../stores/useAssistantStore';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { SceneBuilderModal } from './SceneBuilderModal';

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  description?: string;
  actions: SceneAction[];
}

const API_URL = `${API_BASE_URL}/api/v1`;

const getMetadataText = (metadata: Record<string, unknown>, keys: string[], fallback: string): string => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return fallback;
};

interface DashboardViewProps {
  onActionExecute?: (label: string) => void;
  onNavigate?: (view: View, params?: unknown) => void;
  displayName?: string | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onActionExecute, onNavigate, displayName }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [automations, setAutomations] = useState<DashboardAutomation[]>([]);
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: AssistantFindingAction; deviceName?: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [luxuryRipple, setLuxuryRipple] = useState(false);
  const allDevices = useDeviceSnapshotStore((state) => state.devices);
  const devices = useMemo(() => allDevices.filter((device) => device.status === 'ASSIGNED'), [allDevices]);
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const findings = useAssistantStore((state) => state.findings);
  const refreshFindings = useAssistantStore((state) => state.refreshFindings);
  const resolveFinding = useAssistantStore((state) => state.resolveFinding);

  const homeId = homes[0]?.id || null;
  const rooms = useMemo(() => homeId ? roomsByHome[homeId] || [] : [], [homeId, roomsByHome]);

  const fetchData = useCallback(async () => {
    try {
      await Promise.all([refreshSnapshot(), refreshFindings()]);
      if (!homeId) return;

      const [scenesResponse, automationsResponse] = await Promise.all([
        apiFetch(`${API_URL}/scenes?homeId=${homeId}`),
        apiFetch(`${API_URL}/automations`),
      ]);
      if (scenesResponse.ok) setScenes(await scenesResponse.json() as Scene[]);
      if (automationsResponse.ok) setAutomations(await automationsResponse.json() as DashboardAutomation[]);
    } catch {
      setScenes([]);
      setAutomations([]);
    }
  }, [homeId, refreshFindings, refreshSnapshot]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const executeDeviceCommand = useCallback(async (deviceId: string, command: string): Promise<SnapshotDevice | null> => {
    const response = await apiFetch(`${API_URL}/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    return response.ok ? await response.json() as SnapshotDevice : null;
  }, []);

  const handleSceneExecute = async (scene: Scene) => {
    if (processingId) return;
    setProcessingId(`scene_${scene.id}`);
    setLuxuryRipple(true);
    window.setTimeout(() => setLuxuryRipple(false), 1500);
    onActionExecute?.(scene.name);
    try {
      await apiFetch(`${API_URL}/scenes/${scene.id}/execute`, { method: 'POST' });
      await fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleAutomationToggle = async (automation: DashboardAutomation) => {
    if (processingId) return;
    setProcessingId(automation.id);
    try {
      const action = automation.enabled ? 'disable' : 'enable';
      const response = await apiFetch(`${API_URL}/automations/${automation.id}/${action}`, { method: 'PATCH' });
      if (response.ok) {
        setAutomations((current) => current.map((item) => item.id === automation.id ? { ...item, enabled: !item.enabled } : item));
        onActionExecute?.(automation.name);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleAction = async (finding: AssistantFinding, action: AssistantFindingAction) => {
    if (action.type === 'ignore' || action.type === 'dismiss') {
      await resolveFinding(finding.id);
      await fetchData();
      return;
    }
    if (action.type === 'configure_automation') {
      onNavigate?.('automations');
      return;
    }
    if (action.type === 'turn_off_device' && typeof action.payload?.deviceId === 'string') {
      await executeDeviceCommand(action.payload.deviceId, 'turn_off');
      await resolveFinding(finding.id);
      await fetchData();
      return;
    }
    setActiveAction({
      findingId: finding.id,
      action,
      deviceName: getMetadataText(finding.metadata, ['friendlyName', 'deviceName', 'name'], finding.id),
    });
  };

  const prioritizedFindings = useMemo(() => [...findings]
    .filter((finding) => finding.severity === 'high' || finding.severity === 'medium')
    .sort((left, right) => {
      const score = (finding: AssistantFinding) => Number(finding.type.includes('energy') || finding.type.includes('consumption') || finding.type.includes('long_running'));
      return score(right) - score(left);
    }), [findings]);

  const greetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 19) return 'afternoon';
    return 'evening';
  }, []);
  const favoriteSceneIds = useMemo(() => readFavoriteIds(SCENE_FAVORITES_STORAGE_KEY), [scenes]);
  const favoriteAutomationIds = useMemo(() => readFavoriteIds(AUTOMATION_FAVORITES_STORAGE_KEY), [automations]);

  if (snapshotLoading && allDevices.length === 0) return <DashboardLoadingState />;

  return (
    <div className="flex flex-col gap-6 pb-10 animate-in fade-in duration-500 sm:gap-8 sm:pb-12">
      <DashboardAtmosphereRipple active={luxuryRipple} />

      <header className="flex flex-col gap-5 pt-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-caption font-semibold text-primary">{t('dashboard.home_label')}</p>
          <h1 className="mt-1 text-view-title font-semibold tracking-display-tight text-foreground min-[380px]:text-display-title">
            {t(`dashboard.greeting_${greetingKey}`, { name: displayName || t('dashboard.resident') })}
          </h1>
          <p className="mt-2 text-body text-muted-foreground">{t('dashboard.home_calm')}</p>
        </div>
        <HomeClimateSummary devices={allDevices} />
      </header>

      <DashboardScenesSection
        scenes={scenes}
        favoriteSceneIds={favoriteSceneIds}
        allDevices={allDevices}
        roomProcessing={processingId}
        onCreateScene={() => setIsSceneModalOpen(true)}
        onManageScenes={() => onNavigate?.('scenes')}
        onSceneExecute={handleSceneExecute}
      />

      <DashboardAutomationsSection
        automations={automations}
        favoriteAutomationIds={favoriteAutomationIds}
        processingId={processingId}
        onToggle={handleAutomationToggle}
        onCreate={() => onNavigate?.('automations')}
        onManage={() => onNavigate?.('automations')}
      />

      <DashboardInsightsSection findings={prioritizedFindings} onAction={handleAction} />

      {isSceneModalOpen && homeId && (
        <SceneBuilderModal
          onClose={() => setIsSceneModalOpen(false)}
          onSaved={() => { void fetchData(); setIsSceneModalOpen(false); }}
          homeId={homeId}
          rooms={rooms}
          devices={devices}
        />
      )}

      {activeAction && (
        <AssistantActionModal
          findingId={activeAction.findingId}
          action={activeAction.action}
          deviceName={activeAction.deviceName}
          onClose={() => setActiveAction(null)}
          onSuccess={() => { setActiveAction(null); void fetchData(); }}
        />
      )}
    </div>
  );
};
