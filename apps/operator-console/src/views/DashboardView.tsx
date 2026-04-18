import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cpu, Loader2, Plus, 
  Lightbulb, ToggleRight, Zap, Sparkles, ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { SceneBuilderModal } from './SceneBuilderModal';
import { humanize, disambiguate } from '../lib/naming-utils';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from '../types';
import type { HomeMode } from '../types';
import { HomeModeSelector } from '../components/HomeModeSelector';
import { CurtainDeviceTile } from '../components/CurtainDeviceTile';
import { Button } from '../components/ui/Button';
import { AssistantCard } from '../components/ui/AssistantCard';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { useAssistantStore } from '../stores/useAssistantStore';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import type { AssistantFinding } from '../stores/useAssistantStore';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

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

const DashDeviceTile: React.FC<{ 
  device: Device; 
  onUpdate?: (updated: Device) => void;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}> = ({ device, onUpdate, roomName, isDuplicateName, onActionExecute }) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const actualIsOn = lastState.on === true || lastState.state === 'on' || (Number(lastState.brightness) > 0) || (Number(lastState.power) > 0);
  const isOn = optimisticState !== null ? optimisticState : actualIsOn;
  const isOffline = device.status === 'PENDING';
  
  const isSonoff = device.integrationSource === 'sonoff';
  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || isOffline) return;
    
    const nextState = !isOn;
    setOptimisticState(nextState);
    setIsProcessing(true);

    try {
      const command = nextState ? 'turn_on' : 'turn_off';
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (res.ok) {
        const updated = await res.json();
        setOptimisticState(null);
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', { 
          name: displayName, 
          action: t(`common.actions.${command}`) 
        }));
      } else {
        setOptimisticState(null);
      }
    } catch {
      setOptimisticState(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const Icon = device.type === 'light' ? Lightbulb : (device.type === 'switch' ? ToggleRight : Cpu);

  const localizedState = isOffline 
    ? t('device_states.error') 
    : (isOn ? t('device_states.on') : t('device_states.off'));

  return (
    <div 
      onClick={handleToggle}
      data-demo="device-tile"
      className={cn(
        "relative group cursor-pointer transition-all duration-500 rounded-[2rem] p-4 flex flex-col justify-between border-2 active:scale-95 h-full hover:-translate-y-1 hover:shadow-xl overflow-hidden",
        isOn ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" : "bg-card border-border shadow-md hover:border-primary/20",
        (!isOn && isSonoff) && "hover:border-success/40",
        isOffline && "opacity-30 grayscale pointer-events-none hover:translate-y-0"
      )}
    >
      {/* Edge Atmosphere Glow (Background Pulse for Local) */}
      {isSonoff && isProcessing && (
        <div className="absolute inset-0 bg-success/5 animate-atmospheric-glow pointer-events-none" />
      )}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 z-10",
        isOn ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground/40",
        (isSonoff && isProcessing) && "bg-success text-white scale-110 shadow-success/20 shadow-xl"
      )}>
        {isProcessing && isSonoff ? (
          <Zap className="w-5 h-5 animate-pulse" />
        ) : (
          <Icon className={cn("w-4 h-4", isOn && "animate-pulse")} />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <h4 className="text-xs font-bold truncate tracking-tight">{displayName}</h4>
          {isSonoff && (
            <span className="text-[7px] font-black uppercase tracking-widest bg-success/10 text-success border border-success/20 px-1 py-0.5 rounded shrink-0">Local</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-h-[12px]">
          {isProcessing ? (
            <>
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSonoff ? "bg-success animate-ping" : "status-dot-updating")} />
              <span className={cn("text-[8px] font-black uppercase tracking-widest truncate", isSonoff ? "text-success" : "opacity-40")}>
                {isSonoff ? "Edge Exec" : t('device_states.updating')}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "text-[9px] font-medium tracking-wide transition-opacity duration-300 truncate",
                isOn ? "text-primary opacity-90" : "text-muted-foreground/50"
              )}>
                {localizedState}
              </span>
              {isSonoff && (
                <>
                  <span className="w-1 h-1 bg-border rounded-full shrink-0" />
                  <span className={cn("text-[8px] font-black uppercase tracking-widest shrink-0", isOnline ? "text-success" : "text-destructive opacity-80")}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const mapSnapshotToDevice = (snapshot: SnapshotDevice): Device => {
  const {
    externalId: _externalId,
    vendor: _vendor,
    entityVersion: _entityVersion,
    ...device
  } = snapshot;

  return device;
};

export const DashboardView: React.FC<{ 
  onModeChange?: (mode: HomeMode) => void;
  onActionExecute?: (label: string) => void;
}> = ({ onModeChange, onActionExecute }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeAction, setActiveAction] = useState<any | null>(null);
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
      const response = await fetch(`${API_URL}/scenes?homeId=${homeId}`);
      if (response.ok) {
        setScenes(await response.json());
      }
    }
  } catch {
    setScenes([]);
  }
}, [homeId, refreshFindings, refreshSnapshot]); // Stable dependencies only

useEffect(() => {
  fetchData();
}, [homeId, fetchData]);



  const handleDeviceUpdate = (updated: Device) => {
    upsertDevice(updated);
  };

  const handleSceneExecute = async (scene: Scene) => {
    if (roomProcessing) return;
    setRoomProcessing('scene_' + scene.id);
    setLuxuryRipple(true);
    setTimeout(() => setLuxuryRipple(false), 1500);
    if (onActionExecute) onActionExecute(scene.name);

    try {
      await fetch(`${API_URL}/scenes/${scene.id}/execute`, { method: 'POST' });
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
      await Promise.all(devicesToTurnOff.map(d => 
        fetch(`${API_URL}/devices/${d.id}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'turn_off' })
        })
      ));
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setRoomProcessing(null);
    }
  };

  const handleAction = async (finding: any, action: any) => {
    if (action.type === 'turn_off_device') {
      try {
        await fetch(`${API_URL}/devices/${action.payload.deviceId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'turn_off' })
        });
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
      deviceName: finding.metadata.friendlyName || finding.metadata.deviceName || finding.metadata.name || finding.id
    });
  };

  const prioritizedFindings = useMemo(() => {
    return findings
      .filter((finding: AssistantFinding) => finding.severity === 'high' || finding.severity === 'medium')
      .sort((a: AssistantFinding, b: AssistantFinding) => {
        const aEnergy = a.type.includes('energy') || a.type.includes('consumption') || a.type.includes('long_running') ? 1 : 0;
        const bEnergy = b.type.includes('energy') || b.type.includes('consumption') || b.type.includes('long_running') ? 1 : 0;
        return bEnergy - aEnergy;
      });
  }, [findings]);

  const hasInitialData = devices.length > 0;
  if (snapshotLoading && !hasInitialData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      </div>
    );
  }

  const activeRooms = rooms.filter(r => devices.some(d => d.roomId === r.id));
  const localDevices = useMemo(() => devices.filter(d => d.integrationSource === 'sonoff'), [devices]);
  const hasLocalDevices = localDevices.length > 0;
  const bridgedCount = devices.length - localDevices.length;
  const onlineLocalCount = useMemo(() => 
    localDevices.filter(d => Date.now() - new Date(d.updatedAt || 0).getTime() < 300000).length,
  [localDevices]);

  return (
    <div className="flex flex-col gap-12 pb-12 px-4 md:px-8 animate-in fade-in duration-700">
      {luxuryRipple && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vmax] h-[100vmax] rounded-full border border-primary/20 animate-luxury-ripple" />
        </div>
      )}

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
        <div className="flex flex-col items-center justify-center -mt-6 gap-4">
           {/* Badge */}
           <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary/80 backdrop-blur-md shadow-sm">
              <Cpu className="w-3.5 h-3.5" />
              <span>Edge Network Active</span>
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse mx-1" />
              <span className="text-muted-foreground/60 tracking-wider">Independent Local Control</span>
           </div>

           {/* Stats Summary */}
           <div className="flex items-center gap-8 py-1">
              <div className="flex flex-col items-center gap-1 group">
                 <span className="text-[14px] font-black text-foreground tracking-tight">{localDevices.length}</span>
                 <span className="text-[8px] font-black uppercase tracking-[0.2em] text-success/60">Local {onlineLocalCount < localDevices.length && `(${onlineLocalCount} Online)`}</span>
              </div>
              <div className="w-px h-6 bg-border/40" />
              <div className="flex flex-col items-center gap-1">
                 <span className="text-[14px] font-black text-foreground tracking-tight">{bridgedCount}</span>
                 <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Bridged</span>
              </div>
              <div className="w-px h-6 bg-border/40" />
              <div className="flex flex-col gap-1 items-start max-w-[120px]">
                 <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-2.5 h-2.5 text-primary opacity-60" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">Resilient</span>
                 </div>
                 <p className="text-[7px] font-bold leading-tight text-muted-foreground/40 uppercase italic">
                    {t('dashboard.resilience_hint', 'Hardware-level autonomy active. Network independence verified.')}
                 </p>
              </div>
           </div>
        </div>
      )}

      {/* LEVEL 1.5: Proactive Insights */}
      {prioritizedFindings.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 space-y-6">
          <div className="flex items-center gap-3 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
               {t('dashboard.actionable_insights', 'Actionable Insights')}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-muted to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prioritizedFindings.slice(0, 2).map((finding) => {
               const isEnergy = finding.type.includes('energy') || finding.type.includes('consumption') || finding.type.includes('long_running');
               return (
               <AssistantCard 
                  key={finding.id}
                  icon={isEnergy ? Zap : Sparkles}
                  category={isEnergy ? t('dashboard.energy_insight', 'ENERGY INSIGHT') : t('dashboard.proactive', 'PROACTIVE')}
                  title={finding.metadata?.displayTitle ? finding.metadata.displayTitle : t(`assistant.types.${finding.type}`)}
                  description={finding.metadata?.displayDescription ? finding.metadata.displayDescription : t(`assistant.types.${finding.type}_description`, finding.metadata) as string}
                  severity={finding.severity}
                  actions={
                    <div className="flex gap-2 w-full mt-2">
                      {finding.actions.map((a: any, idx: number) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant={idx === 0 ? "primary" : "secondary"}
                          onClick={() => handleAction(finding, a)}
                          className="flex-1 text-[10px] uppercase tracking-widest h-auto py-3"
                        >
                          {t(a.label)}
                        </Button>
                      ))}
                    </div>
                  }
               />
             )})}
          </div>
        </div>
      )}

      {/* LEVEL 2: Atmosphere Recipes (Promoted Scenes) */}
      {scenes.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/30">{t('dashboard.atmosphere_recipes')}</h2>
            <Button 
              variant="ghost"
              onClick={() => setIsSceneModalOpen(true)}
              className="group gap-2 text-[10px] text-primary/60 hover:text-primary px-0 h-auto"
            >
              <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-500" />
              {t('dashboard.new_scene')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map(scene => {
              const sceneActions = scene.actions || [];
              const localActions = sceneActions.filter(action => {
                const device = allDevices.find(d => d.id === action.deviceId);
                return device?.integrationSource === 'sonoff';
              });
              const isEdgeResilient = localActions.length > 0;
              const isFullyAutonomous = localActions.length === sceneActions.length && sceneActions.length > 0;
              const isProcessingThis = roomProcessing === 'scene_' + scene.id;

              return (
              <button
                key={scene.id}
                onClick={() => handleSceneExecute(scene)}
                disabled={!!roomProcessing}
                className={cn(
                  "group relative flex items-center gap-6 p-6 rounded-[2.5rem] transition-all duration-500 text-left overflow-hidden border-2 active:scale-95 disabled:opacity-50 hover:-translate-y-1 hover:shadow-xl",
                  isProcessingThis 
                    ? "bg-primary border-primary text-primary-foreground shadow-2xl" 
                    : "bg-card border-border shadow-md hover:border-primary/40",
                  (isEdgeResilient && !isProcessingThis) && "hover:border-success/30"
                )}
              >
                {/* Edge Atmospheric Pulsar */}
                {isEdgeResilient && isProcessingThis && (
                  <div className="absolute inset-0 bg-success/10 animate-atmospheric-glow pointer-events-none" />
                )}

                <div className={cn(
                  "p-4 rounded-2xl transition-all duration-700 z-10",
                  isProcessingThis ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
                  (isEdgeResilient && isProcessingThis) && "bg-success shadow-lg shadow-success/40 scale-110"
                )}>
                  {isEdgeResilient && isProcessingThis ? <Cpu className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1 z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-base font-black tracking-tight truncate">{scene.name}</h3>
                    {isEdgeResilient && (
                      <span className={cn(
                        "text-[7px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-full border shrink-0",
                        isProcessingThis 
                          ? "bg-white/20 border-white/40 text-white" 
                          : "bg-success/5 border-success/20 text-success/80"
                      )}>
                        {isFullyAutonomous ? "Autonomous" : "Edge"}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-[10px] font-medium italic opacity-60 truncate",
                    isProcessingThis ? "text-white" : "text-muted-foreground"
                  )}>
                    {isFullyAutonomous ? "Hardware-level execution active" : (scene.description || t('dashboard.experience'))}
                  </p>
                </div>
              </button>
            )})}
          </div>
        </div>
      )}

      {/* LEVEL 3: Spatial Context (Rooms) */}
      <div className="space-y-16">
        {activeRooms.map(room => {
          const roomDevices = devices.filter(d => d.roomId === room.id);
          const onCount = roomDevices.filter(d => {
             const s = d.lastKnownState as DeviceState || {};
             return s.on === true || s.state === 'on' || (Number(s.brightness) > 0);
          }).length;
          
          return (
            <div key={room.id} className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="flex items-center justify-between mb-8 px-2 border-l-4 border-muted-foreground/10 pl-6">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter luxury-text-gradient">{room.name}</h3>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest transition-colors",
                    onCount > 0 ? "text-warning" : "text-muted-foreground/40"
                  )}>
                    {onCount > 0 ? t('dashboard.active_units', { count: onCount, defaultValue: `${onCount} Active` }) : t('dashboard.all_off', { defaultValue: 'All Off' })}
                  </span>
                </div>
                {onCount > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    isLoading={roomProcessing === room.id}
                    onClick={() => handleRoomTurnOff(room.id)}
                    className="text-[9px] uppercase tracking-widest px-4 py-2 bg-transparent hover:bg-danger/10 hover:text-danger border-border hover:border-danger/30 rounded-xl"
                  >
                    {!roomProcessing && t('common.turn_off_all', { defaultValue: 'Turn Off All' })}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 grid-auto-rows-[240px]">
                {roomDevices.map((device) => {
                  const tileDevice = mapSnapshotToDevice(device);

                  return device.type === 'cover' ? (
                    <CurtainDeviceTile
                      key={device.id}
                      device={tileDevice}
                      roomName={room.name}
                      isDuplicateName={(duplicateNames.get(humanize(device.id, device.name)) || 0) > 1}
                      onUpdate={handleDeviceUpdate}
                      onActionExecute={onActionExecute}
                    />
                  ) : (
                    <DashDeviceTile
                      key={device.id}
                      device={tileDevice}
                      roomName={room.name}
                      isDuplicateName={(duplicateNames.get(humanize(device.id, device.name)) || 0) > 1}
                      onUpdate={handleDeviceUpdate}
                      onActionExecute={onActionExecute}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
