import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { SceneBuilderModal } from './SceneBuilderModal';
import { humanize } from '../lib/naming-utils';
import { canExecuteCommand, hasCapability } from '../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import { getSafeHomeMode } from '../types';
import type { HomeMode, View } from '../types';
import { DashboardAtmosphereRipple } from '../components/DashboardAtmosphereRipple';
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

interface DeviceActivityState {
  on?: boolean;
  state?: 'on' | 'off' | 'open' | 'closed' | 'opening' | 'closing';
  brightness?: number;
  power?: number;
  current_position?: unknown;
  position?: unknown;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
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

const parseCoverPosition = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(100, Math.max(0, parsed));
};

const isDeviceActive = (device: SnapshotDevice): boolean => {
  if (isDeviceUnavailable(device)) return false;
  const state = (device.lastKnownState || {}) as DeviceActivityState;

  if (hasCapability(device, 'cover')) {
    const position = parseCoverPosition(state.current_position)
      ?? parseCoverPosition(state.position)
      ?? parseCoverPosition(state.attributes?.current_position)
      ?? parseCoverPosition(state.attributes?.position);
    const functionalPosition = position !== undefined && device.invertState ? 100 - position : position;

    if (functionalPosition !== undefined) {
      return functionalPosition > 0;
    }

    return state.state === 'open' || state.state === 'opening';
  }

  return state.on === true
    || state.state === 'on'
    || Number(state.brightness) > 0
    || Number(state.power) > 0;
};

export const DashboardView: React.FC<{ 
  currentMode: HomeMode;
  onModeChange?: (mode: HomeMode) => void;
  onActionExecute?: (label: string) => void;
  onNavigate?: (view: View, params?: unknown) => void;
  displayName?: string | null;
}> = ({ currentMode, onModeChange, onActionExecute, onNavigate, displayName }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: AssistantFindingAction; deviceName?: string } | null>(null);
  const [roomProcessing, setRoomProcessing] = useState<string | null>(null);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
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
    const devicesToTurnOff = devices.filter((device) => device.roomId === roomId && isDeviceActive(device));
    const executableCommands = devicesToTurnOff
      .map((device) => {
        if (hasCapability(device, 'cover')) {
          const command = 'close';
          return canExecuteCommand(device, command) ? { deviceId: device.id, command } : null;
        }

        return canExecuteCommand(device, 'turn_off') ? { deviceId: device.id, command: 'turn_off' } : null;
      })
      .filter((item): item is { deviceId: string; command: string } => item !== null);

    try {
      await Promise.all(executableCommands.map((item) =>
        executeDeviceCommand(item.deviceId, item.command)
      ));
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setRoomProcessing(null);
    }
  };

  const handleRoomLightsTurnOff = async (roomId: string) => {
    const processingKey = `room_lights_${roomId}`;
    setRoomProcessing(processingKey);
    const lightsToTurnOff = devices.filter((device) => (
      device.roomId === roomId
      && isDeviceActive(device)
      && (device.semanticType === 'light' || device.type === 'light' || hasCapability(device, 'light'))
      && canExecuteCommand(device, 'turn_off')
    ));

    try {
      await Promise.all(lightsToTurnOff.map((device) => executeDeviceCommand(device.id, 'turn_off')));
      await fetchData();
    } catch (error: unknown) {
      console.error('[Dashboard] Failed to turn off room lights:', error);
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
  const activeDeviceCount = useMemo(() => devices.filter(isDeviceActive).length, [devices]);
  const greetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 19) return 'afternoon';
    return 'evening';
  }, []);
  const modeScene = useMemo(() => {
    const normalizedModeNames: Record<HomeMode, string[]> = {
      relax: ['relax'],
      away: ['away', 'fuera'],
      night: ['night', 'noche'],
      energy: ['energy', 'eco'],
    };
    return scenes.find((scene) => normalizedModeNames[currentMode].includes(scene.name.trim().toLowerCase())) || null;
  }, [currentMode, scenes]);
  const orderedActiveRooms = useMemo(() => {
    if (currentMode === 'relax') return activeRooms;
    return [...activeRooms].sort((left, right) => {
      const activeInRoom = (roomId: string) => devices.filter((device) => device.roomId === roomId && isDeviceActive(device)).length;
      return activeInRoom(right.id) - activeInRoom(left.id);
    });
  }, [activeRooms, currentMode, devices]);

  const hasInitialData = (Array.isArray(devices) ? devices : []).length > 0;
  const favoriteSceneIds = useMemo(() => {
    try {
      const stored = localStorage.getItem('hp_fav_scenes');
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }, [scenes]);
  if (snapshotLoading && !hasInitialData) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="flex flex-col gap-5 pb-10 animate-in fade-in duration-500 sm:gap-7 sm:pb-12">
      <DashboardAtmosphereRipple active={luxuryRipple} />

      <header className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-end sm:justify-between sm:pt-2">
        <div className="min-w-0">
          <p className="text-caption font-semibold text-primary">{t('dashboard.home_label', { defaultValue: 'Mi hogar' })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-foreground min-[380px]:text-3xl sm:text-4xl">
            {t(`dashboard.greeting_${greetingKey}`, { name: displayName || t('dashboard.resident', { defaultValue: 'Oscar' }) })}
          </h1>
          <p className="mt-2 text-body text-muted-foreground">{t('dashboard.home_calm', { defaultValue: 'Todo está bajo control.' })}</p>
        </div>
        <div className="flex w-fit max-w-full items-center gap-2 rounded-pill border border-border/50 bg-card/45 px-3 py-2 text-caption text-muted-foreground">
          <span className="h-2 w-2 rounded-pill bg-success" />
          <span className="min-w-0 truncate">
            {t('dashboard.active_summary', { active: activeDeviceCount, total: devices.length, defaultValue: `${activeDeviceCount} de ${devices.length} dispositivos activos` })}
          </span>
        </div>
      </header>

      {/* LEVEL 1: Master State (Home Mode) */}
      <HomeModeSelector 
        currentMode={getSafeHomeMode(currentMode)} 
        onModeChange={(mode) => onModeChange?.(getSafeHomeMode(mode))}
        linkedSceneName={modeScene?.name}
        isExecutingScene={modeScene ? roomProcessing === `scene_${modeScene.id}` : false}
        onExecuteLinkedScene={modeScene ? () => handleSceneExecute(modeScene) : undefined}
      />

      <DashboardInsightsSection
        findings={prioritizedFindings}
        onAction={handleAction}
      />

      <DashboardScenesSection
        scenes={scenes}
        favoriteSceneIds={favoriteSceneIds}
        allDevices={allDevices}
        roomProcessing={roomProcessing}
        onCreateScene={() => setIsSceneModalOpen(true)}
        onManageScenes={() => onNavigate?.('scenes')}
        onSceneExecute={handleSceneExecute}
      />

      <DashboardRoomsSection
        activeRooms={orderedActiveRooms}
        mode={currentMode}
        devices={devices}
        duplicateNames={duplicateNames}
        roomProcessing={roomProcessing}
        onRoomTurnOff={handleRoomTurnOff}
        onRoomLightsTurnOff={handleRoomLightsTurnOff}
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
