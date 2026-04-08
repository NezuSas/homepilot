import React, { useEffect, useState, useCallback } from 'react';
import { 
  Inbox, RadioTower, Box, Activity,
  Loader2, RefreshCw, X, AlertCircle, ArrowRight,
  Settings, Database, Clock, Terminal, Cpu
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
  createdAt?: string;
  updatedAt?: string;
}

interface Room {
  id: string;
  name: string;
  homeId: string;
}

interface ActivityLog {
  timestamp: string;
  deviceId: string;
  type: string;
  description: string;
  data: Record<string, unknown>;
}

const API_URL = `${API_BASE_URL}/api/v1`;

/**
 * Appliance-style compact device tile.
 */
const DeviceTile: React.FC<{ 
  device: Device; 
  rooms: Room[];
  onUpdate?: (updated: Device) => void;
  onInspect?: () => void;
}> = ({ device, rooms, onUpdate, onInspect }) => {
  const isAssigned = device.status === 'ASSIGNED';
  const isPending = device.status === 'PENDING';
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Determine state for visual cues
  const lastState = (device.lastKnownState || {}) as DeviceState;
  const isOn = lastState.on === true || lastState.state === 'on' || (Number(lastState.brightness) > 0) || (Number(lastState.power) > 0);
  
  const supportsCommands = device.type === 'light' || device.type === 'switch';

  useEffect(() => {
    if (isPending && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, isPending, selectedRoomId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Mandatory: action only
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

  const handleAssign = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedRoomId || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoomId })
      });
      if (res.ok && onUpdate) {
        onUpdate(await res.json());
      } else {
        setError('Assign failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get Icon based on type
  const Icon = device.type === 'light' ? RadioTower : (device.type === 'switch' ? Box : Cpu);

  return (
    <div 
      onClick={onInspect}
      className={cn(
        "relative group cursor-pointer transition-all duration-300",
        "aspect-square min-w-[140px] p-4 rounded-2xl flex flex-col justify-between border-2",
        "bg-card hover:shadow-xl hover:border-primary/40",
        isOn && isAssigned ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border shadow-sm",
        isProcessing && "opacity-70 scale-[0.98] bg-muted/50",
        error && "border-destructive/40 bg-destructive/5"
      )}
    >
      {/* Top: Icon & State Toggle */}
      <div className="flex justify-between items-start">
        <div className={cn(
          "p-2.5 rounded-xl transition-all duration-300",
          isOn && isAssigned ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-muted text-muted-foreground",
          isProcessing && "animate-pulse"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        
        {supportsCommands && isAssigned && (
          <button
            onClick={handleToggle}
            disabled={isProcessing}
            className={cn(
              "p-2 rounded-full border-2 transition-all flex items-center justify-center",
              isOn ? "bg-primary border-primary text-white shadow-md" : "bg-background border-border text-muted-foreground hover:border-primary/50",
              isProcessing && "bg-muted border-primary/20"
            )}
          >
             {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className={cn("w-4 h-4", isOn && "rotate-180")} />}
          </button>
        )}
      </div>

      {/* Center: Error Layer */}
      {error && !isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-[1px] rounded-2xl p-2 text-center">
            <AlertCircle className="w-5 h-5 text-destructive mb-1" />
            <span className="text-[8px] font-black uppercase text-destructive leading-tight">{error}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setError(null); }}
              className="mt-1 text-[7px] font-black uppercase text-muted-foreground border-b border-muted-foreground/30"
            >
              Dismiss
            </button>
        </div>
      )}

      {/* Bottom: Info */}
      <div className={cn("flex flex-col gap-1 overflow-hidden transition-opacity", (isProcessing || error) && "opacity-30")}>
        <span className="text-xs font-black uppercase tracking-tighter truncate opacity-50">{device.type}</span>
        <h4 className="text-sm font-bold leading-tight truncate">{device.name}</h4>
        
        {isAssigned ? (
          <div className="flex items-center gap-1.5 mt-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", isOn ? "bg-primary animate-pulse" : "bg-muted-foreground/30")} />
            <span className={cn("text-[9px] font-black uppercase tracking-widest", isOn ? "text-primary" : "text-muted-foreground")}>
              {isOn ? 'Active' : 'Standby'}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
             <select 
               onClick={(e) => e.stopPropagation()}
               disabled={isProcessing}
               className="bg-muted/50 border border-border rounded px-1.5 py-1 text-[9px] font-bold outline-none w-full"
               value={selectedRoomId}
               onChange={(e) => setSelectedRoomId(e.target.value)}
             >
               {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
               {rooms.length === 0 && <option value="">No Rooms</option>}
             </select>
             <button 
               onClick={handleAssign}
               disabled={!selectedRoomId || isProcessing}
               className="w-full bg-primary/10 text-primary py-1 rounded text-[8px] font-black uppercase border border-primary/20 hover:bg-primary/20 transition-colors"
             >
               {isProcessing ? '...' : 'Assign'}
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Vista de Inbox principal para la Operator Console.
 */
export const InboxView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [roomsByHome, setRoomsByHome] = useState<Record<string, Room[]>>({});
  const [loading, setLoading] = useState(true);
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'light' | 'switch' | 'sensor'>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      if (!res.ok) throw new Error('Refresh error');
      const data = await res.json() as Device[];
      setDevices(data || []);
      
      const homeIds = Array.from(new Set(data.map(d => d.homeId)));
      const roomsData: Record<string, Room[]> = {};
      await Promise.all(homeIds.map(async (hId) => {
        const rRes = await fetch(`${API_URL}/homes/${hId}/rooms`);
        if (rRes.ok) roomsData[hId] = await rRes.json();
      }));
      setRoomsByHome(roomsData);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceUpdate = (deviceId: string, updated: Device) => {
    setDevices((prev: Device[]) => prev.map((d: Device) => d.id === deviceId ? updated : d));
  };

  // Grouping logic
  const filtered = devices.filter((d: Device) => {
    if (filter === 'all') return true;
    return d.type === filter;
  });

  const roomsFlattened = Object.values(roomsByHome).flat();
  
  const grouped = filtered.reduce((acc: Record<string, { name: string, devices: Device[] }>, dev: Device) => {
    const isPending = dev.status === 'PENDING';
    const room = roomsFlattened.find((r: Room) => r.id === dev.roomId);
    const groupId = isPending || !room ? 'UNASSIGNED' : room.id;
    const groupName = isPending || !room ? 'Unassigned / Pending Commissioning' : room.name;
    
    if (!acc[groupId]) acc[groupId] = { name: groupName, devices: [] };
    acc[groupId].devices.push(dev);
    return acc;
  }, {} as Record<string, { name: string, devices: Device[] }>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-2">
      {inspectingDeviceId && (
        <DeviceInspector 
          deviceId={inspectingDeviceId} 
          onClose={() => setInspectingDeviceId(null)} 
          onUpdate={(updated) => handleDeviceUpdate(inspectingDeviceId, updated)}
        />
      )}

      {/* Discovery Layer */}
      <HomeAssistantDiscoverySection onImported={fetchData} />

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-xl font-black tracking-tight truncate">Device Manager</h2>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 truncate">Appliance-Style Controller v3.1</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl border border-border/50 overflow-x-auto no-scrollbar max-w-full">
          {(['all', 'light', 'switch', 'sensor'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                filter === f ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:bg-background/20"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Adaptive Grid Rendering */}
      <div className="flex flex-col gap-12">
        {Object.entries(grouped).map(([id, group]) => (
          <section key={id} className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 group/header">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                {group.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/30 hidden sm:block min-w-[20px]" />
                <span className="px-3 py-1 bg-muted rounded-full text-[10px] font-black border border-border opacity-50 whitespace-nowrap">
                  {group.devices.length} {group.devices.length === 1 ? 'Unit' : 'Units'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
              {group.devices.map(device => (
                <DeviceTile 
                  key={device.id} 
                  device={device} 
                  rooms={roomsByHome[device.homeId] || []}
                  onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
                  onInspect={() => setInspectingDeviceId(device.id)}
                />
              ))}
            </div>
          </section>
        ))}

        {devices.length === 0 && (
          <div className="py-24 border-2 border-dashed border-border rounded-[3rem] flex flex-col items-center justify-center text-center opacity-20">
             <Cpu className="w-12 h-12 mb-4" />
             <p className="text-sm font-black uppercase tracking-widest">No devices connected</p>
          </div>
        )}
      </div>
    </div>
  );
};

const DeviceInspector: React.FC<{ 
  deviceId: string; 
  onClose: () => void;
  onUpdate: (updated: Device) => void;
}> = ({ deviceId, onClose, onUpdate }) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'state'>('info');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchDetails = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [devRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/devices/${deviceId}`),
        fetch(`${API_URL}/devices/${deviceId}/activity-logs`)
      ]);
      if (devRes.ok) {
        const devData = await devRes.json() as Device;
        setDevice(devData);
        setNewName(devData.name);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json() as ActivityLog[];
        setLogs(logsData);
      }
    } catch {
      setError('Failed to fetch details');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [deviceId, API_URL]);

  useEffect(() => {
    fetchDetails(true);
  }, [fetchDetails]);

  const handleRename = async () => {
    if (!device || !newName.trim() || newName === device.name) {
      setIsRenaming(false);
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        const updated = await res.json() as Device;
        setDevice(updated);
        onUpdate(updated);
        setIsRenaming(false);
      }
    } catch {
      setError('Failed to rename device');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle') => {
    if (!device || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (res.ok) {
        const updated = await res.json() as Device;
        setDevice(updated);
        onUpdate(updated);
        // REMOVED: redundant activity-logs fetch. Logs updated only when explicitly requested.
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!device || isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/refresh`, {
        method: 'POST'
      });
      if (res.ok) {
        const updated = await res.json() as Device;
        setDevice(updated);
        onUpdate(updated);
        // REMOVED: redundant HA sync log fetch.
      } else {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to refresh state from Home Assistant');
      }
    } catch (err: any) {
      const msg = err.error?.message || (typeof err.error === 'string' ? err.error : (err.message || 'Error syncing with HA'));
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!device) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
        {/* Header */}
        <div className="p-8 bg-muted/30 border-b border-border relative">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-3 bg-primary/10 text-primary rounded-xl">
                 <RadioTower className="w-6 h-6" />
               </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Technical Inspector</span>
                    <span className="text-[9px] bg-primary/5 text-primary/60 px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-tighter">Local Alias Only</span>
                  </div>
                 {isRenaming ? (
                   <div className="flex items-center gap-2 mt-1">
                     <input 
                       className="bg-background border border-primary/40 rounded px-2 py-1 text-lg font-black outline-none focus:ring-2 focus:ring-primary/20"
                       value={newName}
                       onChange={(e) => setNewName(e.target.value)}
                       autoFocus
                       onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                     />
                     <button onClick={handleRename} className="p-1 px-2 bg-primary text-white text-[10px] font-black rounded uppercase">Save</button>
                     <button onClick={() => { setIsRenaming(false); setNewName(device.name); }} className="text-[10px] uppercase font-bold text-muted-foreground group">
                       <span className="border-b border-transparent group-hover:border-muted-foreground transition-all ml-1">Cancel</span>
                     </button>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2 group/title">
                     <h2 className="text-2xl font-black tracking-tight">{device.name}</h2>
                     <button 
                       onClick={() => setIsRenaming(true)}
                       className="p-1 opacity-0 group-hover/title:opacity-100 transition-opacity hover:bg-muted rounded text-muted-foreground"
                     >
                       <Settings className="w-4 h-4" />
                     </button>
                   </div>
                 )}
               </div>
             </div>
             <button 
               onClick={onClose} 
               className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
             >
               <X className="w-6 h-6" />
             </button>
          </div>

          <div className="flex gap-4 p-1 bg-muted/50 rounded-2xl border border-border/50">
             {(['info', 'logs', 'state'] as const).map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={cn(
                   "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   activeTab === tab 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                 )}
               >
                 {tab}
               </button>
             ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'info' && (
            <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-muted/20 border border-border rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                    <Database className="w-3 h-3" /> Technical ID
                  </span>
                  <span className="font-mono text-xs font-bold break-all">{device.id}</span>
                </div>
                <div className="p-5 bg-muted/20 border border-border rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> External ID
                  </span>
                  <span className="font-mono text-xs font-bold break-all">{device.externalId}</span>
                </div>
              </div>

              <div className="mt-4 p-8 bg-black/5 border-2 border-dashed border-border/50 rounded-[2.5rem] flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Supported Actions</span>
                  <Activity className="w-4 h-4 opacity-20" />
                </div>
                
                {(device.type === 'light' || device.type === 'switch') && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleCommand('turn_on')}
                      className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-primary text-white hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-primary/10"
                    >
                      FORCE ON
                    </button>
                    <button 
                      onClick={() => handleCommand('turn_off')}
                      className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-muted text-foreground hover:bg-muted/80 transition-colors"
                    >
                      FORCE OFF
                    </button>
                    <button 
                      onClick={() => handleCommand('toggle')}
                      className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      TOGGLE
                    </button>
                  </div>
                )}

                {device.externalId.startsWith('ha:') && (
                  <div className="pt-6 border-t border-border/20 flex flex-col gap-4">
                    <button 
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all flex items-center justify-center gap-3 group"
                    >
                       <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                       {isRefreshing ? 'Synchronizing Snapshots...' : 'Manual Refresh from Home Assistant'}
                    </button>
                    {error && (
                      <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 border border-border rounded-2xl bg-card flex flex-col gap-1 shadow-sm">
                   <div className="flex items-center gap-2 mb-2">
                     <Box className="w-4 h-4 opacity-40 text-primary" />
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Placement</span>
                   </div>
                   <span className="text-sm font-bold truncate">{device.roomId || 'UNASSIGNED_LOGICAL_UNIT'}</span>
                 </div>
                 <div className="p-6 border border-border rounded-2xl bg-card flex flex-col gap-1 shadow-sm">
                   <div className="flex items-center gap-2 mb-2 text-primary">
                     <Cpu className="w-4 h-4 opacity-40" />
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Home Cluster</span>
                   </div>
                   <span className="text-sm font-bold truncate">{device.homeId}</span>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-500">
              {logs.map((log: ActivityLog, index: number) => (
                <div key={index} className="p-5 bg-muted/10 border border-border/20 rounded-[1.5rem] flex flex-col gap-2 group hover:bg-muted/20 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-tighter">
                      {log.type}
                    </span>
                    <span className="text-[9px] font-mono opacity-40 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight mt-1 text-card-foreground/80">{log.description}</p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center opacity-10">
                   <Terminal className="w-12 h-12 mb-4" />
                   <div className="text-xs font-black uppercase tracking-[0.2em]">No logs recorded</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'state' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 h-full">
              <div className="flex-1 bg-[#0D0D0D] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-4 right-8 text-[9px] font-black font-mono opacity-20 tracking-widest group-hover:opacity-40 transition-opacity">READ_ONLY_MODE::JSON_PARSER</div>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                  <pre className="text-[11px] font-mono text-green-400 overflow-auto h-full leading-relaxed custom-scrollbar relative z-10 selection:bg-primary/30">
                    {JSON.stringify(device.lastKnownState, null, 4)}
                  </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-6 border-t border-border/50 bg-muted/10 text-center">
           <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-20">HomePilot Core Data Object v2.0</p>
        </div>
      </div>
    </div>
  );
};

interface HaEntityCandidate {
  entityId: string;
  state: string;
  friendlyName: string;
  domain: string;
}

const HomeAssistantDiscoverySection: React.FC<{ onImported: () => void }> = ({ onImported }) => {
  const [entities, setEntities] = useState<HaEntityCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const API_URL = `${API_BASE_URL}/api/v1`;


  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/ha/entities`);
      if (!res.ok) throw new Error('Failed to fetch entities from Home Assistant');
      setEntities(await res.json());
      setShowDiscovery(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery Error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (entity: HaEntityCandidate) => {
    setImportingId(entity.entityId);
    try {
      const res = await fetch(`${API_URL}/ha/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.entityId })
      });
      if (res.ok) {
        onImported();
        setEntities((prev: HaEntityCandidate[]) => prev.filter((e: HaEntityCandidate) => e.entityId !== entity.entityId));
      } else if (res.status === 409) {
        setError('Device already imported');
        setEntities((prev: HaEntityCandidate[]) => prev.filter((e: HaEntityCandidate) => e.entityId !== entity.entityId));
      } else {
        const data = await res.json();
        const msg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Import failed');
        setError(`Error: ${msg}`);
      }
    } catch {
      setError('Import failed');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
          <RadioTower className="w-4 h-4" /> Home Assistant Bridge
        </h3>
        <button 
          onClick={showDiscovery ? () => setShowDiscovery(false) : fetchCandidates}
          disabled={loading}
          className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className={cn("w-3.5 h-3.5", showDiscovery && "rotate-180")} />}
          {showDiscovery ? 'Close Discovery' : 'Discover Entities'}
        </button>
      </div>

      {showDiscovery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
          {entities.map((entity: HaEntityCandidate) => (
            <div key={entity.entityId} className="p-4 bg-card border border-border rounded-xl flex flex-col gap-3 group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-5">
                 <RadioTower className="w-8 h-8" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-mono opacity-40 uppercase truncate">{entity.entityId}</span>
                 <span className="text-xs font-black truncate">{entity.friendlyName}</span>
               </div>
               <div className="flex items-center justify-between mt-1">
                 <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold uppercase">{entity.domain}</span>
                 <button 
                   onClick={() => handleImport(entity)}
                   disabled={importingId === entity.entityId}
                   className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                 >
                   {importingId === entity.entityId ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                   Import
                 </button>
               </div>
            </div>
          ))}
          {entities.length === 0 && !loading && (
            <div className="col-span-full py-8 text-center border-2 border-dashed rounded-xl opacity-40">
              <p className="text-[10px] font-black uppercase tracking-widest">No new entities found</p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-[10px] text-destructive bg-destructive/5 p-2 rounded-lg border border-destructive/20 text-center uppercase font-bold">{error}</p>}
    </div>
  );
};
