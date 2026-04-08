import React, { useEffect, useState, useCallback } from 'react';
import { 
  Server, Inbox, RadioTower, Box, CheckCircle2, AlertCircle, 
  Loader2, ArrowRight, Power, RefreshCw, Eye, X, Activity, 
  Settings, Database, Info, Clock, Terminal, Cpu
} from 'lucide-react';
import { cn } from '../lib/utils';

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

/**
 * Vista de Inbox principal para la Operator Console.
 */
export const InboxView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const API_URL = 'http://localhost:3000/api/v1';

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      if (!res.ok) throw new Error('Error al recuperar dispositivos');
      const data = await res.json() as Device[];
      setDevices(data || []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeviceUpdate = (deviceId: string, updatedDevice: Device) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? updatedDevice : d));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Sincronizando estado...</p>
      </div>
    );
  }

  const pendingDevices = devices.filter(d => d.status === 'PENDING');
  const assignedDevices = devices.filter(d => d.status === 'ASSIGNED');

  return (
    <div className="flex flex-col gap-10 relative">
      {inspectingDeviceId && (
        <DeviceInspector 
          deviceId={inspectingDeviceId} 
          onClose={() => setInspectingDeviceId(null)} 
          onUpdate={(updated) => handleDeviceUpdate(inspectingDeviceId, updated)}
        />
      )}

      {/* Discovery Section */}
      <HomeAssistantDiscoverySection onImported={fetchData} />

      {/* Inbox Section */}
      <section className="flex flex-col gap-5">
        <div className="flex justify-between items-end">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Device Inbox 
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px] font-black">
              {pendingDevices.length}
            </span>
          </h3>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {pendingDevices.map(device => (
            <DeviceCard 
              key={device.id} 
              device={device} 
              onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
              onInspect={() => setInspectingDeviceId(device.id)}
            />
          ))}
          {pendingDevices.length === 0 && (
            <div className="col-span-full py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
               <Box className="w-8 h-8 mb-2 opacity-20" />
               <p className="text-xs font-medium italic">Inbox is empty</p>
            </div>
          )}
        </div>
      </section>

      {/* Assigned Section */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
          <Server className="w-4 h-4" /> Assigned Devices
          <span className="bg-muted text-foreground px-2 py-0.5 rounded-full text-[10px] font-black">
            {assignedDevices.length}
          </span>
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {assignedDevices.map(device => (
            <DeviceCard 
              key={device.id} 
              device={device} 
              onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
              onInspect={() => setInspectingDeviceId(device.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

const DeviceCard: React.FC<{ 
  device: Device; 
  onUpdate?: (updated: Device) => void;
  onInspect?: () => void;
}> = ({ device, onUpdate, onInspect }) => {
  const isAssigned = device.status === 'ASSIGNED';
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const API_URL = 'http://localhost:3000/api/v1';

  const supportsCommands = device.type === 'light' || device.type === 'switch';

  useEffect(() => {
    if (!isAssigned && device.homeId) {
      fetch(`${API_URL}/homes/${device.homeId}/rooms`)
        .then(res => res.json())
        .then((data: Room[]) => {
          setRooms(data || []);
          if (data.length > 0) setSelectedRoomId(data[0].id);
        })
        .catch(console.error);
    }
  }, [device.homeId, isAssigned]);

  const handleAssign = async () => {
    if (!selectedRoomId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoomId })
      });
      if (res.ok && onUpdate) {
        onUpdate(await res.json());
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle') => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (res.ok && onUpdate) {
        onUpdate(await res.json());
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col p-5 border border-border rounded-xl bg-card shadow-sm hover:border-primary/40 transition-all group relative",
      isProcessing && "opacity-60 pointer-events-none"
    )}>
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-lg",
            isAssigned ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            <RadioTower className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base leading-none mb-1.5">{device.name}</span>
            <span className="text-[11px] text-muted-foreground font-mono">{device.externalId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onInspect}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAssigned ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded">PENDING</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-muted/40 rounded-lg text-xs border border-border/50">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold opacity-50 mb-0.5">Type</span>
          <span className="font-medium capitalize">{device.type}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold opacity-50 mb-0.5">Vendor</span>
          <span className="font-medium">{device.vendor}</span>
        </div>
        
        {!isAssigned && (
          <div className="col-span-2 pt-2 border-t border-border/20 mt-1 flex flex-col gap-3">
             <select 
               className="bg-background border border-border rounded px-2 py-1.5 text-[11px]"
               value={selectedRoomId}
               onChange={(e) => setSelectedRoomId(e.target.value)}
             >
               {rooms.map(room => (
                 <option key={room.id} value={room.id}>{room.name}</option>
               ))}
             </select>
             <button 
               onClick={handleAssign}
               className="w-full bg-primary text-white py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
             >
               Assign <ArrowRight className="w-3 h-3" />
             </button>
          </div>
        )}

        {isAssigned && supportsCommands && (
          <div className="col-span-2 pt-3 border-t border-border/20 mt-2 flex gap-2">
            <button 
              onClick={() => handleCommand('turn_on')}
              className="flex-1 bg-primary/10 text-primary p-2 rounded text-[10px] font-bold hover:bg-primary/20 transition-colors"
            >
              ON
            </button>
            <button 
              onClick={() => handleCommand('turn_off')}
              className="flex-1 bg-muted text-foreground p-2 rounded text-[10px] font-bold hover:bg-muted/80 transition-colors"
            >
              OFF
            </button>
            <button 
              onClick={() => handleCommand('toggle')}
              className="aspect-square bg-secondary text-secondary-foreground p-2 rounded flex items-center justify-center hover:bg-secondary/80 transition-all font-bold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isProcessing && "animate-spin")} />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute top-2 right-3 text-[8px] font-mono opacity-30">STATE_SNAPSHOT</div>
        <pre className="bg-black/90 text-green-400 p-3 rounded-lg text-[10px] font-mono shadow-inner overflow-x-auto custom-scrollbar leading-relaxed">
          {JSON.stringify(device.lastKnownState, null, 2)}
        </pre>
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'state'>('info');
  const API_URL = 'http://localhost:3000/api/v1';

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [devRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/devices/${deviceId}`),
        fetch(`${API_URL}/devices/${deviceId}/activity-logs`)
      ]);
      if (devRes.ok) {
        const devData = await devRes.json() as Device;
        setDevice(devData);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json() as ActivityLog[];
        setLogs(logsData);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch details');
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle') => {
    if (!device) return;
    const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    if (res.ok) {
      const updated = await res.json() as Device;
      setDevice(updated);
      onUpdate(updated);
      fetchDetails();
    }
  };

  const handleRefresh = async () => {
    if (!device) return;
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
      } else {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to refresh state from Home Assistant');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error syncing with HA');
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
                 <span className="text-[10px] font-black uppercase tracking-widest text-primary">Technical Inspector</span>
                 <h2 className="text-2xl font-black tracking-tight">{device.name}</h2>
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
              {logs.map((log, index) => (
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
  const API_URL = 'http://localhost:3000/api/v1';

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
        setEntities(prev => prev.filter(e => e.entityId !== entity.entityId));
      } else if (res.status === 409) {
        alert('Dispositivo ya importado');
        setEntities(prev => prev.filter(e => e.entityId !== entity.entityId));
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Import failed');
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
          {entities.map(entity => (
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
