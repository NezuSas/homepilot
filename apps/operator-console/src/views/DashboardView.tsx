import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { SceneBuilderModal } from './SceneBuilderModal';
import { humanize } from '../lib/naming-utils';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from '../types';
import type { HomeMode, View } from '../types';
import { DashboardAtmosphereRipple } from '../components/DashboardAtmosphereRipple';
import { DashboardEdgeStatus } from '../components/DashboardEdgeStatus';
import { DashboardInsightsSection } from '../components/DashboardInsightsSection';
import { DashboardLoadingState } from '../components/DashboardLoadingState';
import { DashboardRoomsSection } from '../components/DashboardRoomsSection';
import { DashboardScenesSection } from '../components/DashboardScenesSection';
import { HomeModeSelector } from '../components/HomeModeSelector';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { useAssistantStore } from '../stores/useAssistantStore';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

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

const getMetadataText = (
  metadata: Record<string, unknown>,
  keys: string[],
  fallback: string
): string => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
};

export const DashboardView: React.FC<{ 
  onModeChange?: (mode: HomeMode) => void;
  onActionExecute?: (label: string) => void;
  onNavigate?: (view: View, params?: unknown) => void;
}> = ({ onModeChange, onActionExecute, onNavigate }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: AssistantFindingAction; deviceName?: string } | null>(null);
  const [roomProcessing, setRoomProcessing] = useState<string | null>(null);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<HomeMode>(DEFAULT_HOME_MODE);
  const [luxuryRipple, setLuxuryRipple] = useState(false);
  const allDevices = useDeviceSnapshotStore((state) => state.devices);
  const devices = useMemo(() => allDevices.filter((device) => device.status === 'ASSIGNED'), [allDevices]);
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);
  const findings = useAssistantStore((state) => state.findings);
  const refreshFindings = useAssistantStore((state) => state.refreshFindings);
  const resolveFinding = useAssistantStore((state) => state.resolveFinding);

  const primaryHomeId = homes[0]?.id || null;
  const rooms = useMemo(() => {
    if (!primaryHomeId) return [];
    return roomsByHome[primaryHomeId] || [];
  }, [primaryHomeId, roomsByHome]);

  const homeId = useMemo(() => {
    if (primaryHomeId) return primaryHomeId;
    if (rooms.length > 0) return rooms[0].homeId;
    return null;
  }, [primaryHomeId, rooms]);

const fetchData = useCallback(async () => {
  try {
    await Promise.all([refreshSnapshot(), refreshFindings()]);

    if (homeId) {
      const response = await apiFetch(`${API_URL}/scenes?homeId=${homeId}`);
      if (response.ok) {
        setScenes(await response.json());
      }
    }
  } catch {
    setScenes([]);
  }
}, [homeId, refreshFindings, refreshSnapshot]);

useEffect(() => {
  fetchData();
}, [homeId, fetchData]);

  const executeDeviceCommand = useCallback(async (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>
  ): Promise<SnapshotDevice | null> => {
    const response = await apiFetch(`${API_URL}/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: params ? { name: command, params } : command,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as SnapshotDevice;
  }, []);

  const handleDeviceUpdate = (updated: SnapshotDevice) => {
    upsertDevice(updated);
  };

  const handleSceneExecute = async (scene: Scene) => {
    if (roomProcessing) return;
    setRoomProcessing('scene_' + scene.id);
    setLuxuryRipple(true);
    setTimeout(() => setLuxuryRipple(false), 1500);
    if (onActionExecute) onActionExecute(scene.name);

    try {
      await apiFetch(`${API_URL}/scenes/${scene.id}/execute`, { method: 'POST' });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setRoomProcessing(null);
    }
  };

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    devices.forEach(d => {
      const name = humanize(d.id, d.name);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return counts;
  }, [devices]);

  const handleRoomTurnOff = async (roomId: string) => {
    setRoomProcessing(roomId);
    const devicesToTurnOff = devices.filter(d => d.roomId === roomId && (d.lastKnownState?.on === true || d.lastKnownState?.state === 'on' || Number(d.lastKnownState?.brightness) > 0));
    try {
      await Promise.all((Array.isArray(devicesToTurnOff) ? devicesToTurnOff : []).map(d => 
        executeDeviceCommand(d.id, 'turn_off')
      ));
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setRoomProcessing(null);
    }
  };

  const handleAction = async (finding: AssistantFinding, action: AssistantFindingAction) => {
    if (action.type === 'ignore' || action.type === 'dismiss') {
      try {
        await resolveFinding(finding.id);
        await fetchData();
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', { name: finding.id, action: t('assistant.actions.ignore') }));
      } catch (e) {
        console.error('Dismiss failed:', e);
      }
      return;
    }

    if (action.type === 'configure_automation') {
      if (onNavigate) {
        onNavigate('automations');
      }
      return;
    }

    if (action.type === 'turn_off_device') {
      const deviceId = action.payload?.deviceId;
      if (typeof deviceId !== 'string') {
        return;
      }

      try {
        await executeDeviceCommand(deviceId, 'turn_off');
        await resolveFinding(finding.id);
        await fetchData();
      } catch (e) {
        console.error('Action failed:', e);
      }
      return;
    }
    
    setActiveAction({ 
      findingId: finding.id, 
      action,
      deviceName: getMetadataText(finding.metadata, ['friendlyName', 'deviceName', 'name'], finding.id)
    });
  };

  const prioritizedFindings = useMemo(() => {
    return (Array.isArray(findings) ? findings : [])
      .filter((finding: AssistantFinding) => finding.severity === 'high' || finding.severity === 'medium')
      .sort((a: AssistantFinding, b: AssistantFinding) => {
        const aEnergy = a.type.includes('energy') || a.type.includes('consumption') || a.type.includes('long_running') ? 1 : 0;
        const bEnergy = b.type.includes('energy') || b.type.includes('consumption') || b.type.includes('long_running') ? 1 : 0;
        return bEnergy - aEnergy;
      });
  }, [findings]);

  const activeRooms = useMemo(() => (Array.isArray(rooms) ? rooms : []).filter(r => (Array.isArray(devices) ? devices : []).some(d => d.roomId === r.id)), [rooms, devices]);
  const localDevices = useMemo(() => (Array.isArray(devices) ? devices : []).filter(d => d.integrationSource === 'sonoff'), [devices]);
  const hasLocalDevices = localDevices.length > 0;
  const bridgedCount = (Array.isArray(devices) ? devices : []).length - localDevices.length;
  const onlineLocalCount = useMemo(() => 
    localDevices.filter(d => Date.now() - new Date(d.updatedAt || 0).getTime() < 300000).length,
  [localDevices]);

  const hasInitialData = (Array.isArray(devices) ? devices : []).length > 0;
  if (snapshotLoading && !hasInitialData) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="flex flex-col gap-10 pb-12 px-4 md:px-8 animate-in fade-in duration-500">
      <DashboardAtmosphereRipple active={luxuryRipple} />

      {/* LEVEL 1: Master State (Home Mode) */}
      <HomeModeSelector 
        currentMode={getSafeHomeMode(currentMode)} 
        onModeChange={(m) => {
          const safeM = getSafeHomeMode(m);
          setCurrentMode(safeM);
          if (onModeChange) onModeChange(safeM);
        }} 
      />

      {hasLocalDevices && (
        <DashboardEdgeStatus
          localDeviceCount={localDevices.length}
          onlineLocalCount={onlineLocalCount}
          bridgedCount={bridgedCount}
        />
      )}

      <DashboardInsightsSection
        findings={prioritizedFindings}
        onAction={handleAction}
      />

      <DashboardScenesSection
        scenes={scenes}
        allDevices={allDevices}
        roomProcessing={roomProcessing}
        onCreateScene={() => setIsSceneModalOpen(true)}
        onSceneExecute={handleSceneExecute}
      />

      <DashboardRoomsSection
        activeRooms={activeRooms}
        devices={devices}
        duplicateNames={duplicateNames}
        roomProcessing={roomProcessing}
        onRoomTurnOff={handleRoomTurnOff}
        onDeviceUpdate={handleDeviceUpdate}
        onCommand={executeDeviceCommand}
        onActionExecute={onActionExecute}
      />

      {isSceneModalOpen && homeId && (
        <SceneBuilderModal 
          onClose={() => setIsSceneModalOpen(false)}
          onSaved={() => { fetchData(); setIsSceneModalOpen(false); }}
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
          onSuccess={() => { setActiveAction(null); fetchData(); }}
        />
      )}
    </div>
  );
};
