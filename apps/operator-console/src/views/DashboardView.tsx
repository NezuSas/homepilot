import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cpu, Loader2, Plus, 
  Lightbulb, ToggleRight, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { SceneBuilderModal } from './SceneBuilderModal';
import { humanize, disambiguate } from '../lib/naming-utils';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from '../types';
import type { HomeMode } from '../types';
import { HomeModeSelector } from '../components/HomeModeSelector';
import { CurtainDeviceTile } from '../components/CurtainDeviceTile';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

interface Device {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  type: string;
  status: 'PENDING' | 'ASSIGNED';
  invertState?: boolean;
  lastKnownState: Record<string, unknown> | null;
}

interface Room {
  id: string;
  name: string;
  homeId: string;
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
        if (onActionExecute) onActionExecute(`${displayName} turned ${nextState ? 'on' : 'off'}`);
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
      className={cn(
        "relative group cursor-pointer transition-all duration-500 rounded-[2rem] p-4 flex flex-col justify-between border-2 active:scale-95 h-full",
        isOn ? "bg-primary/5 border-primary" : "bg-card/20 border-border/40 hover:border-primary/20",
        isOffline && "opacity-30 grayscale pointer-events-none"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
        isOn ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground/40"
      )}>
        <Icon className={cn("w-4 h-4", isOn && "animate-pulse")} />
      </div>

      <div className="flex flex-col min-w-0">
        <h4 className="text-xs font-bold truncate tracking-tight mb-1">{displayName}</h4>
        <div className="flex items-center gap-1.5 min-h-[12px]">
          {isProcessing ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full status-dot-updating" />
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40">
                {t('device_states.updating')}
              </span>
            </>
          ) : (
            <span className={cn(
              "text-[9px] font-medium tracking-wide transition-opacity duration-300",
              isOn ? "text-primary opacity-90" : "text-muted-foreground/50"
            )}>
              {localizedState}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const DashboardView: React.FC<{ 
  onModeChange?: (mode: HomeMode) => void;
  onActionExecute?: (label: string) => void;
}> = ({ onModeChange, onActionExecute }) => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomProcessing, setRoomProcessing] = useState<string | null>(null);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<HomeMode>(DEFAULT_HOME_MODE);
  const [luxuryRipple, setLuxuryRipple] = useState(false);

  const homeId = rooms.length > 0 ? rooms[0].homeId : null;

  const fetchData = useCallback(async () => {
    try {
      const [devRes, homeRes] = await Promise.all([
        fetch(`${API_URL}/devices`),
        fetch(`${API_URL}/homes`)
      ]);
      const allDevices = await devRes.json() as Device[];
      setDevices(allDevices.filter(d => d.status === 'ASSIGNED'));

      const homes = await homeRes.json();
      if (homes.length > 0) {
        const [rRes, sRes] = await Promise.all([
           fetch(`${API_URL}/homes/${homes[0].id}/rooms`),
           fetch(`${API_URL}/scenes?homeId=${homes[0].id}`)
        ]);
        if (rRes.ok) setRooms(await rRes.json());
        if (sRes.ok) setScenes(await sRes.json());
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceUpdate = (updated: Device) => {
    setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      </div>
    );
  }

  const activeRooms = rooms.filter(r => devices.some(d => d.roomId === r.id));

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

      {/* LEVEL 2: Atmosphere Recipes (Promoted Scenes) */}
      {scenes.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/30">{t('dashboard.atmosphere_recipes')}</h2>
            <button 
              onClick={() => setIsSceneModalOpen(true)}
              className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-all"
            >
              <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-500" />
              {t('dashboard.new_scene')}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map(scene => (
              <button
                key={scene.id}
                onClick={() => handleSceneExecute(scene)}
                disabled={!!roomProcessing}
                className={cn(
                  "group relative flex items-center gap-6 p-6 rounded-[2.5rem] transition-all duration-700 text-left overflow-hidden border-2 active:scale-95 disabled:opacity-50",
                  roomProcessing === 'scene_' + scene.id 
                    ? "bg-primary border-primary text-primary-foreground shadow-2xl" 
                    : "bg-card/40 hover:bg-card/60 border-border/40 hover:border-primary/40"
                )}
              >
                <div className={cn(
                  "p-4 rounded-2xl transition-all duration-700",
                  roomProcessing === 'scene_' + scene.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                )}>
                  <Zap className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black tracking-tight truncate">{scene.name}</h3>
                  <p className={cn(
                    "text-[10px] font-medium italic opacity-60 truncate",
                    roomProcessing === 'scene_' + scene.id ? "text-white" : "text-muted-foreground"
                  )}>
                    {scene.description || t('dashboard.experience')}
                  </p>
                </div>
              </button>
            ))}
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                    {onCount} {t('dashboard.active')} • {roomDevices.length} {t('dashboard.elements')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 grid-auto-rows-[240px]">
                {roomDevices.map(device => (
                  device.type === 'cover' ? (
                    <CurtainDeviceTile
                      key={device.id}
                      device={device}
                      roomName={room.name}
                      isDuplicateName={(duplicateNames.get(humanize(device.id, device.name)) || 0) > 1}
                      onUpdate={handleDeviceUpdate}
                      onActionExecute={onActionExecute}
                    />
                  ) : (
                    <DashDeviceTile 
                      key={device.id} 
                      device={device} 
                      roomName={room.name}
                      isDuplicateName={(duplicateNames.get(humanize(device.id, device.name)) || 0) > 1}
                      onUpdate={handleDeviceUpdate} 
                      onActionExecute={onActionExecute}
                    />
                  )
                ))}
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
    </div>
  );
};
