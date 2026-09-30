import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { DashboardAtmosphereRipple } from '../components/DashboardAtmosphereRipple';
import {
  DashboardRoutinesSection,
  type DashboardRoutineAutomation,
} from '../components/DashboardRoutinesSection';
import { DashboardInsightsSection } from '../components/DashboardInsightsSection';
import { LoadingState } from '../components/ui/LoadingState';
import { HomeClimateSummary } from '../components/HomeClimateSummary';
import { API_BASE_URL } from '../config';
import { useAutomationFavorites, useSceneFavorites } from '../lib/useSceneFavorites';
import { apiFetch } from '../lib/apiClient';
import { EMPTY_HOME_PERSONALIZATION, getHomePeriod, HOME_HERO_INTERVAL_MS, msUntilNextHomePeriod, resolveHomePhrase, type HomePersonalization } from '../lib/homePersonalization';
import { fetchDiagnosticResource } from '../lib/diagnosticResourceRequests';
import type { View } from '../types';
import { useAssistantStore } from '../stores/useAssistantStore';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { getSceneOrRoutineUrl } from './dashboards/widgets/sectionCardAssignments';
import { useMomentaryActionFeedback } from './dashboards/widgets/useMomentaryActionFeedback';

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  icon?: string;
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
  currentUserId: string | null;
  onOpenOwnDashboardTab: (dashboardId: string, tabId: string) => void;
  canManageAutomations: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onActionExecute, onNavigate, displayName, currentUserId, onOpenOwnDashboardTab, canManageAutomations }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [automations, setAutomations] = useState<DashboardRoutineAutomation[]>([]);
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: AssistantFindingAction; deviceName?: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingIdRef = useRef<string | null>(null);
  const { actionFeedback, clearActionFeedback, showActionFeedback } = useMomentaryActionFeedback();
  const [luxuryRipple, setLuxuryRipple] = useState(false);
  const [homePersonalization, setHomePersonalization] = useState<HomePersonalization>(EMPTY_HOME_PERSONALIZATION);
  const [homePeriod, setHomePeriod] = useState(() => getHomePeriod(new Date()));
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const allDevices = useDeviceSnapshotStore((state) => state.devices);
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const findings = useAssistantStore((state) => state.findings);
  const refreshFindings = useAssistantStore((state) => state.refreshFindings);
  const resolveFinding = useAssistantStore((state) => state.resolveFinding);

  const homeId = homes[0]?.id || null;
  const dataRequest = useRef<AbortController | null>(null);
  const fetchData = useCallback(async () => {
    dataRequest.current?.abort();
    const controller = new AbortController();
    dataRequest.current = controller;
    try {
      await Promise.all([refreshSnapshot(), refreshFindings()]);
      if (!homeId || controller.signal.aborted) return;

      const scenesResponse = await fetchDiagnosticResource(`${API_URL}/scenes`, controller.signal);
      if (scenesResponse.ok) {
        const nextScenes = await scenesResponse.json() as Scene[];
        if (!controller.signal.aborted) setScenes(nextScenes);
      }
      if (!canManageAutomations) {
        if (!controller.signal.aborted) setAutomations([]);
        return;
      }

      const automationsResponse = await fetchDiagnosticResource(`${API_URL}/automations`, controller.signal);
      if (automationsResponse.ok) {
        const nextAutomations = await automationsResponse.json() as DashboardRoutineAutomation[];
        if (!controller.signal.aborted) setAutomations(nextAutomations);
      }
    } catch {
      // Preserve the previous routine list during a slow or failed refresh.
    } finally {
      if (dataRequest.current === controller) dataRequest.current = null;
    }
  }, [canManageAutomations, homeId, refreshFindings, refreshSnapshot]);

  useEffect(() => {
    void fetchData();
    return () => dataRequest.current?.abort();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`${API_URL}/settings/home-personalization`, { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setHomePersonalization(await response.json() as HomePersonalization);
      }).catch(() => { /* Keep the built-in image and neutral text when offline. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let timeout: number;
    const schedule = () => {
      const now = new Date();
      setHomePeriod(getHomePeriod(now));
      timeout = window.setTimeout(schedule, msUntilNextHomePeriod(now));
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (homePersonalization.heroImages.length <= 1) return;
    let interval: number | undefined;
    const sync = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = document.hidden ? undefined : window.setInterval(() => {
        setActiveHeroImage((current) => (current + 1) % homePersonalization.heroImages.length);
      }, HOME_HERO_INTERVAL_MS);
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [homePersonalization.heroImages]);

  const executeDeviceCommand = useCallback(async (deviceId: string, command: string): Promise<SnapshotDevice | null> => {
    const response = await apiFetch(`${API_URL}/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    return response.ok ? await response.json() as SnapshotDevice : null;
  }, []);

  const executeFavoriteRoutine = async (id: string, name: string, entityId: string) => {
    if (processingIdRef.current) return;
    processingIdRef.current = id;
    setProcessingId(id);
    clearActionFeedback();
    setLuxuryRipple(true);
    window.setTimeout(() => setLuxuryRipple(false), 1500);
    try {
      const response = await apiFetch(getSceneOrRoutineUrl(entityId), { method: 'POST' });
      if (!response.ok) throw new Error(`FAVORITE_ROUTINE_${response.status}`);
      showActionFeedback(id, 'success');
      onActionExecute?.(name);
      await fetchData();
    } catch {
      showActionFeedback(id, 'error');
    } finally {
      processingIdRef.current = null;
      setProcessingId(null);
    }
  };

  const handleSceneExecute = (scene: Pick<Scene, 'id' | 'name'>) =>
    executeFavoriteRoutine(`scene_${scene.id}`, scene.name, scene.id);

  const handleAutomationExecute = (automation: DashboardRoutineAutomation) =>
    executeFavoriteRoutine(`automation_${automation.id}`, automation.name, `automation:${automation.id}`);

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

  const greetingKey = homePeriod === 'night' ? 'evening' : homePeriod;
  const phrase = resolveHomePhrase(homePersonalization, homePeriod, t('dashboard.home_calm'));
  const heroImages = homePersonalization.heroImages.length > 0
    ? homePersonalization.heroImages.map((image) => `${API_BASE_URL}${image.url}`)
    : ['/home-dashboard-ambient.png'];
  const { favorites: favoriteSceneIds } = useSceneFavorites(currentUserId, scenes.map((scene) => scene.id));
  const { favorites: favoriteAutomationIds } = useAutomationFavorites(
    canManageAutomations ? currentUserId : null,
    automations.map((automation) => automation.id),
  );

  if (snapshotLoading && allDevices.length === 0) return <LoadingState label={t('common.loading')} className="min-h-empty-sm" />;

  return (
    <div className="homepilot-home flex flex-col gap-6 pb-10 animate-in fade-in duration-500 sm:gap-8 sm:pb-12">
      <DashboardAtmosphereRipple active={luxuryRipple} />

      <header className="homepilot-home-hero flex flex-col gap-5">
        {heroImages.map((src, index) => <img
          key={src}
          className={`homepilot-home-hero-image ${index === activeHeroImage || heroImages.length === 1 ? 'opacity-100' : 'opacity-0'}`}
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority={index === 0 ? 'high' : 'auto'}
        />)}
        <div className="homepilot-home-hero-overlay" aria-hidden="true" />
        <div className="relative z-10 min-w-0 lg:max-w-[50%]">
          <h1 className="homepilot-home-greeting text-display-title font-black leading-tight tracking-display-tight text-foreground sm:text-hero-title lg:text-hero-title-lg">
            <span className="block">{t(`dashboard.greeting_${greetingKey}`, { name: '' }).trim()}</span>
            <span className="block break-words">{displayName || t('dashboard.resident')}</span>
          </h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-body text-muted-foreground lg:text-card-title">{phrase}</p>
        </div>
        <div className="relative z-10 min-w-0">
          <HomeClimateSummary currentUserId={currentUserId} onOpenOwnDashboardTab={onOpenOwnDashboardTab} />
        </div>
      </header>

      <DashboardRoutinesSection
        scenes={scenes}
        automations={automations}
        favoriteSceneIds={favoriteSceneIds}
        favoriteAutomationIds={favoriteAutomationIds}
        canManageAutomations={canManageAutomations}
        processingId={processingId}
        actionFeedback={actionFeedback}
        onSceneExecute={handleSceneExecute}
        onAutomationExecute={handleAutomationExecute}
        onManage={() => onNavigate?.('routines')}
      />

      <DashboardInsightsSection findings={prioritizedFindings} onAction={handleAction} />

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
