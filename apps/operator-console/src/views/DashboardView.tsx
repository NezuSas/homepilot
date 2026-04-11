import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  RadioTower, Box, Cpu, AlertCircle, Loader2, LayoutDashboard, Power, Sun
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';

interface DeviceState {
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

interface Device {
  id: string;
  homeId: string;
  roomId: string | null;
  externalId: string;
  name: string;
  type: string;
  vendor: string;
  status: 'PENDING' | 'ASSIGNED';
  lastKnownState: Record<string, unknown> | null;
  entityVersion: number;
}

interface Room {
  id: string;
  name: string;
  homeId: string;
}

const API_URL = `${API_BASE_URL}/api/v1`;

const DashDeviceTile: React.FC<{ 
  device: Device; 
  onUpdate?: (updated: Device) => void;
}> = ({ device, onUpdate }) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const isOn = lastState.on === true || lastState.state === 'on' || (Number(lastState.brightness) > 0) || (Number(lastState.power) > 0);
  const supportsCommands = device.type === 'light' || device.type === 'switch';

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || !supportsCommands) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const command = isOn ? 'turn_off' : 'turn_on';
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (res.ok && onUpdate) {
         // UI will optimisticly update via full refresh in parent or we can use local state.
         // Let's rely on parent update via onUpdate
         onUpdate(await res.json());
      } else {
        const data = await res.json();
        setError(data?.error?.message || 'Toggle failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  const Icon = device.type === 'light' ? RadioTower : (device.type === 'switch' ? Box : Cpu);

  return (
    <div 
      onClick={handleToggle}
      className={cn(
        "relative group cursor-pointer transition-all duration-300",
        "aspect-square min-w-[120px] p-4 rounded-3xl flex flex-col justify-between border-2",
        "bg-card hover:shadow-xl hover:border-primary/40",
        isOn ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border shadow-sm",
        isProcessing && "opacity-70 scale-[0.98] bg-muted/50",
        error && "border-destructive/40 bg-destructive/5"
      )}
    >
      <div className="flex justify-between items-start">
        <div className={cn(
          "p-2.5 rounded-[1rem] transition-all duration-300",
          isOn ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-muted text-muted-foreground",
          isProcessing && "animate-pulse"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {error && !isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-[1px] rounded-3xl p-2 text-center z-10" onClick={(e) => { e.stopPropagation(); setError(null); }}>
             <AlertCircle className="w-5 h-5 text-destructive mb-1" />
             <span className="text-[8px] font-black uppercase text-destructive leading-tight truncate px-1">{error}</span>
        </div>
      )}

      <div className={cn("flex flex-col gap-1 overflow-hidden transition-opacity mt-2", (isProcessing || error) && "opacity-30")}>
        <span className="text-[10px] font-black uppercase tracking-tighter truncate opacity-50">{device.type}</span>
        <h4 className="text-sm font-bold leading-tight truncate">{device.name}</h4>
        
        <div className="flex items-center gap-1.5 mt-1">
          <div className={cn("w-2 h-2 rounded-full", isOn ? "bg-primary" : "bg-muted-foreground/30")} />
          <span className={cn("text-[10px] font-black uppercase tracking-widest", isOn ? "text-primary" : "text-muted-foreground")}>
            {isOn ? t('common.on') : (device.type === 'sensor' ? 'Reading' : t('common.off'))}
          </span>
        </div>
      </div>
    </div>
  );
};


export const DashboardView: React.FC = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomProcessing, setRoomProcessing] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<Record<string, string | null>>({});

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
        const rRes = await fetch(`${API_URL}/homes/${homes[0].id}/rooms`);
        if (rRes.ok) {
           setRooms(await rRes.json());
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceUpdate = (updatedDevice: Device) => {
    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d));
  };

  const handleRoomAction = async (roomId: string, action: 'turn_on' | 'turn_off') => {
    if (roomProcessing) return;
    setRoomProcessing(roomId);
    setRoomError(prev => ({ ...prev, [roomId]: null }));
    try {
      const res = await fetch(`${API_URL}/rooms/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await res.json();
      
      if (!res.ok || (data && data.failed > 0)) {
         const isTotalFailure = data.failed === data.total;
         setRoomError(prev => ({ 
            ...prev, 
            [roomId]: isTotalFailure 
               ? t('dashboard.scene_failed_total', { defaultValue: 'Scene execution failed' }) 
               : t('dashboard.scene_failed_partial', { defaultValue: `${data.failed} of ${data.total} devices failed` }) 
         }));
      }
      
      await fetchData(); // Always refresh local state
    } catch (e) {
      setRoomError(prev => ({ ...prev, [roomId]: 'Network connection error' }));
      console.error(e);
    } finally {
      setRoomProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-50">{t('common.loading')}</p>
      </div>
    );
  }

  // Filter out rooms that have no assigned devices
  const activeRooms = rooms.filter(r => devices.some(d => d.roomId === r.id));

  if (activeRooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] bg-card border rounded-3xl m-4 p-8 text-center ring-1 ring-border/50 shadow-sm">
        <LayoutDashboard className="w-16 h-16 text-muted-foreground/30 mb-6" />
        <h2 className="text-2xl font-black tracking-tighter text-foreground/80 mb-2">{t('nav.dashboard')}</h2>
        <p className="text-muted-foreground font-medium max-w-sm mb-8">{t('inbox.empty_state')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      {activeRooms.map(room => {
        const roomDevices = devices.filter(d => d.roomId === room.id);
        const onCount = roomDevices.filter(d => {
           const s = d.lastKnownState as DeviceState || {};
           return s.on === true || s.state === 'on' || (Number(s.brightness) > 0) || (Number(s.power) > 0);
        }).length;
        
        return (
          <div key={room.id} className="flex flex-col gap-4">
            {/* Error Banner */}
            {roomError[room.id] && (
               <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-destructive/20 rounded-xl">
                     <AlertCircle className="w-4 h-4 text-destructive" />
                   </div>
                   <p className="text-sm font-bold text-destructive/90">{roomError[room.id]}</p>
                 </div>
                 <button 
                   onClick={() => setRoomError(prev => ({ ...prev, [room.id]: null }))}
                   className="text-xs font-black uppercase text-destructive/70 hover:text-destructive px-3 py-1"
                 >
                   dismiss
                 </button>
               </div>
            )}

            {/* Room Header Card */}
            <div className="bg-card border-2 border-border/60 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 z-0 pointer-events-none" />
              
              <div className="relative z-10">
                <h3 className="text-2xl font-black tracking-tighter mb-1">{room.name}</h3>
                <p className="text-sm font-bold text-muted-foreground opacity-80 uppercase tracking-widest">
                  {onCount} {t('common.on')} · {roomDevices.length} {t('common.devices', { defaultValue: 'Devices' })}
                </p>
              </div>

              {/* Quick Scenes */}
              <div className="flex items-center gap-3 relative z-10">
                 <button 
                   disabled={roomProcessing === room.id}
                   onClick={() => handleRoomAction(room.id, 'turn_on')}
                   className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-3 rounded-2xl font-black uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
                 >
                   {roomProcessing === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />} Welcome
                 </button>
                 <button 
                   disabled={roomProcessing === room.id}
                   onClick={() => handleRoomAction(room.id, 'turn_off')}
                   className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-muted hover:bg-foreground/10 text-foreground border border-border px-4 py-3 rounded-2xl font-black uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
                 >
                   {roomProcessing === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} All Off
                 </button>
              </div>
            </div>

            {/* Room Devices Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {roomDevices.map(device => (
                <DashDeviceTile 
                  key={device.id} 
                  device={device} 
                  onUpdate={handleDeviceUpdate} 
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
