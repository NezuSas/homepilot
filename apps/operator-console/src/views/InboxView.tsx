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
 * Vista principal de Gestión de Dispositivos (Inbox / Devices View).
 * Permite la asignación de dispositivos nuevos y el control de dispositivos ya configurados.
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
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al recuperar dispositivos');
      }
      const data = await res.json() as Device[];
      setDevices(data || []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Sincronizando estado de dispositivos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive bg-destructive/10 rounded-xl border border-dashed border-destructive/50 p-8 text-center">
        <AlertCircle className="w-8 h-8 mb-4 shadow-sm" />
        <p className="text-sm font-medium">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); fetchData(); }} className="mt-4 text-xs underline uppercase tracking-widest font-bold">Reintentar</button>
      </div>
    );
  }

  const pendingDevices = devices.filter(d => d.status === 'PENDING');
  const assignedDevices = devices.filter(d => d.status === 'ASSIGNED');

  return (
    <div className="flex flex-col gap-10 relative">
      
      {/* Inspector Panel Overlayer */}
      {inspectingDeviceId && (
        <DeviceInspector 
          deviceId={inspectingDeviceId} 
          onClose={() => setInspectingDeviceId(null)} 
          onUpdate={(updated) => handleDeviceUpdate(inspectingDeviceId, updated)}
        />
      )}

      {/* Sección Inbox / Pendientes */}
      <section className="flex flex-col gap-5">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
          <Inbox className="w-4 h-4" />
          Device Inbox
          <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
            {pendingDevices.length}
          </span>
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {pendingDevices.length === 0 ? (
            <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
              El Inbox está vacío. No hay dispositivos pendientes de asignación.
            </div>
          ) : (
            pendingDevices.map(device => (
              <DeviceCard 
                key={device.id} 
                device={device} 
                onUpdate={(updated) => handleDeviceUpdate(device.id, updated)} 
                onInspect={() => setInspectingDeviceId(device.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Sección Dispositivos Asignados */}
      <section className="flex flex-col gap-5">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2 border-t border-border pt-8">
          <Server className="w-4 h-4" />
          Assigned Devices
          <span className="bg-muted text-foreground px-2 py-0.5 rounded-full text-[10px]">
            {assignedDevices.length}
          </span>
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {assignedDevices.length === 0 ? (
             <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
               No hay dispositivos asignados todavía.
             </div>
          ) : (
            assignedDevices.map(device => (
              <DeviceCard 
                key={device.id} 
                device={device} 
                onUpdate={(updated) => handleDeviceUpdate(device.id, updated)} 
                onInspect={() => setInspectingDeviceId(device.id)}
              />
            ))
          )}
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
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://localhost:3000/api/v1';

  // Solo luces y switches soportan comandos en V1
  const supportsCommands = device.type === 'light' || device.type === 'switch';

  useEffect(() => {
    if (!isAssigned && device.homeId) {
      fetch(`${API_URL}/homes/${device.homeId}/rooms`)
        .then(async res => {
          if (!res.ok) throw new Error('Error al cargar habitaciones');
          return res.json() as Promise<Room[]>;
        })
        .then((data) => {
          setRooms(data || []);
          if (data && data.length > 0) setSelectedRoomId(data[0].id);
        })
        .catch(console.error);
    }
  }, [device.homeId, isAssigned]);

  const handleAssign = async () => {
    if (!selectedRoomId) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoomId })
      });

      const data = await res.json().catch(() => ({ error: 'Error desconocido en el servidor' }));
      if (!res.ok) {
        throw new Error(data.error || 'Error en la asignación');
      }

      if (onUpdate) onUpdate(data as Device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle') => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const data = await res.json().catch(() => ({ error: 'Error desconocido ejecutando comando' }));
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar comando');
      }

      if (onUpdate) onUpdate(data as Device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col p-5 border border-border rounded-xl bg-card shadow-sm hover:border-primary/40 transition-all group relative",
      isProcessing && "opacity-60 pointer-events-none"
    )}>
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px] z-10 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      <div className="flex justify-between items-start mb-5">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-lg transition-colors", 
            isAssigned ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            <RadioTower className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-base leading-none mb-1.5">{device.name}</span>
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[150px]">{device.externalId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onInspect}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
            title="Inspect Technical Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAssigned ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <span className="px-2.5 py-1 bg-primary/20 text-primary text-[10px] uppercase font-bold tracking-wider rounded-md">
              Pending
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-muted/40 rounded-lg text-xs border border-border/50">
         <div className="flex flex-col gap-1">
           <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider">Type</span>
           <span className="font-medium text-foreground capitalize">{device.type}</span>
         </div>
         <div className="flex flex-col gap-1">
           <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider">Vendor</span>
           <span className="font-medium text-foreground">{device.vendor}</span>
         </div>

         {/* Lógica de Asignación (Solo PENDING) */}
         {!isAssigned && (
           <div className="col-span-2 pt-2 border-t border-border/30 mt-1 flex flex-col gap-3">
             <div className="flex flex-col gap-1.5">
               <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider underline decoration-primary/30">Target Room</span>
               <select 
                 className="bg-background border border-border rounded px-2 py-1.5 text-[11px] outline-none focus:border-primary disabled:opacity-50"
                 value={selectedRoomId}
                 onChange={(e) => setSelectedRoomId(e.target.value)}
                 disabled={rooms.length === 0}
               >
                 {rooms.length === 0 ? (
                   <option disabled>No hay habitaciones disponibles</option>
                 ) : (
                   rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                 )}
               </select>
             </div>
             <button 
               onClick={handleAssign}
               disabled={!selectedRoomId || isProcessing}
               className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
             >
               Confirm Assignment <ArrowRight className="w-3 h-3" />
             </button>
           </div>
         )}

         {/* Lógica de Control (Solo ASSIGNED) */}
         {isAssigned && (
          <>
            <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-border/50 mt-1">
              <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider">Room Allocation</span>
              <span className="font-mono text-[10px] text-foreground opacity-80 flex items-center gap-1.5 mt-0.5">
                <Box className="w-3 h-3 text-muted-foreground" />
                {device.roomId || 'Ubicación desconocida'}
              </span>
            </div>
            
            {supportsCommands && (
              <div className="col-span-2 pt-3 border-t border-border/30 mt-2 flex flex-col gap-2">
                <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Power className="w-3 h-3" /> Control Rápido
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleCommand('turn_on')}
                    className="flex-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 p-2 rounded-lg text-[10px] font-bold uppercase transition-all"
                    title="Encender dispositivo"
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => handleCommand('turn_off')}
                    className="flex-1 bg-muted text-muted-foreground border border-border hover:bg-muted/80 p-2 rounded-lg text-[10px] font-bold uppercase transition-all"
                    title="Apagar dispositivo"
                  >
                    OFF
                  </button>
                  <button 
                    onClick={() => handleCommand('toggle')}
                    className="aspect-square bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 p-2 rounded-lg flex items-center justify-center transition-all"
                    title="Alternar estado"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isProcessing && "animate-spin")} />
                  </button>
                </div>
              </div>
            )}
          </>
         )}
      </div>

      {error && (
        <p className="text-[10px] text-destructive mb-3 px-3 py-2 bg-destructive/5 rounded-md flex items-center gap-1.5 font-medium border border-destructive/10 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-3.5 h-3.5" /> 
          <span className="flex-1">{error}</span>
        </p>
      )}

      <div className="mt-auto">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Telemetría (Snapshot):</span>
        <pre className="bg-[#0D0D0D] text-green-400 p-3 rounded-lg text-[10px] font-mono overflow-x-auto border border-white/5 shadow-inner">
          {device.lastKnownState 
            ? JSON.stringify(device.lastKnownState, null, 2)
            : '// Sin datos de telemetría reportados'}
        </pre>
      </div>

    </div>
  );
};

/**
 * Componente DeviceInspector
 * Panel técnico lateral para auditoría y debugging de dispositivos.
 */
const DeviceInspector: React.FC<{ 
  deviceId: string; 
  onClose: () => void;
  onUpdate: (updated: Device) => void;
}> = ({ deviceId, onClose, onUpdate }) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
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

      if (!devRes.ok) throw new Error('Fallo al obtener detalle del dispositivo');
      
      const devData = await devRes.json() as Device;
      const logsData = await logsRes.json() as ActivityLog[];

      setDevice(devData);
      setLogs(logsData || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando inspector');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle') => {
    if (!device) return;
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
        fetchDetails(); // Recargar logs
      }
    } catch (err) {
        console.error('Command failed', err);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <span className="text-xs font-black uppercase tracking-widest animate-pulse">Mounting Device Inspector...</span>
      </div>
    </div>
  );

  if (error || !device) return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-10">
      <div className="bg-card border-2 border-destructive/20 p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-6">
        <AlertCircle className="w-16 h-16 text-destructive animate-bounce" />
        <div>
          <h3 className="text-xl font-black uppercase tracking-tighter">Inspector Error</h3>
          <p className="text-sm text-muted-foreground mt-2">{error || 'Device not found'}</p>
        </div>
        <button onClick={onClose} className="w-full bg-primary text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Close Inspector</button>
      </div>
    </div>
  );

  const supportsCommands = device.type === 'light' || device.type === 'switch';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-card border-l border-border shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col animate-in slide-in-from-right-10 duration-500 overflow-hidden">
        
        {/* Header Visual */}
        <div className="p-8 bg-muted/30 border-b border-border/40 relative">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-3 bg-primary/10 text-primary rounded-xl">
                 <RadioTower className="w-6 h-6" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-widest text-primary">Technical Inspector</span>
                 <h2 className="text-2xl font-black tracking-tight leading-none">{device.name}</h2>
               </div>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all group scale-100 hover:scale-110 active:scale-95">
               <X className="w-6 h-6" />
             </button>
          </div>

          <div className="flex gap-4">
             <button onClick={() => setActiveTab('info')} className={cn(
               "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-b-4",
               activeTab === 'info' ? "bg-primary text-white border-primary-foreground/20" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
             )}>
               <div className="flex items-center justify-center gap-2 italic"><Info className="w-3.5 h-3.5" /> Specs</div>
             </button>
             <button onClick={() => setActiveTab('logs')} className={cn(
               "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-b-4",
               activeTab === 'logs' ? "bg-primary text-white border-primary-foreground/20" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
             )}>
               <div className="flex items-center justify-center gap-2 italic"><Activity className="w-3.5 h-3.5" /> Logs</div>
             </button>
             <button onClick={() => setActiveTab('state')} className={cn(
               "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-b-4",
               activeTab === 'state' ? "bg-primary text-white border-primary-foreground/20" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
             )}>
               <div className="flex items-center justify-center gap-2 italic"><Terminal className="w-3.5 h-3.5" /> State</div>
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {activeTab === 'info' && (
            <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-muted/20 border border-border/40 rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Database className="w-3 h-3" /> Technical ID</span>
                  <span className="font-mono text-xs font-bold text-foreground/80 break-all">{device.id}</span>
                </div>
                <div className="p-5 bg-muted/20 border border-border/40 rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Settings className="w-3 h-3" /> External Reference</span>
                  <span className="font-mono text-xs font-bold text-foreground/80 break-all">{device.externalId}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                   <div className="w-1 h-3 bg-primary rounded-full" /> Architecture Placement
                 </h4>
                 <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Home Domain" value={device.homeId} icon={<Box className="w-3 h-3" />} />
                    <InfoRow label="Room Cluster" value={device.roomId || 'UNASSIGNED'} icon={<Database className="w-3 h-3" />} />
                    <InfoRow label="Entity Version" value={`v${device.entityVersion}`} icon={<Cpu className="w-3 h-3" />} />
                    <InfoRow label="Current Status" value={device.status} icon={<CheckCircle2 className="w-3 h-3" />} highlight />
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                   <div className="w-1 h-3 bg-primary rounded-full" /> Temporal Markers
                 </h4>
                 <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Discovery Date" value={device.createdAt ? new Date(device.createdAt).toLocaleString() : 'Legacy Entry'} icon={<Clock className="w-3 h-3" />} />
                    <InfoRow label="Last Convergence" value={device.updatedAt ? new Date(device.updatedAt).toLocaleString() : 'N/A'} icon={<RefreshCw className="w-3 h-3" />} />
                 </div>
              </div>

              <div className="mt-4 p-8 bg-black/5 border-2 border-dashed border-border/40 rounded-[2.5rem] flex flex-col gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Supported Actions</span>
                  <p className="text-xs text-muted-foreground/60 font-medium">Capacidades operativas detectadas para este hardware.</p>
                </div>
                {supportsCommands ? (
                  <div className="flex gap-4">
                    <ActionButton label="TURN ON" onClick={() => handleCommand('turn_on')} color="primary" />
                    <ActionButton label="TURN OFF" onClick={() => handleCommand('turn_off')} color="secondary" />
                    <ActionButton label="TOGGLE" onClick={() => handleCommand('toggle')} color="accent" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-2xl border border-border/20 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest italic">Este dispositivo no soporta comandos directos en V1</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                   <div className="w-2 h-2 bg-primary rounded-full animate-pulse" /> Recent Activity Stream
                </h4>
                <span className="text-[9px] font-bold text-muted-foreground/40">{logs.length} Entries</span>
              </div>
              
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-20 italic">
                   <Terminal className="w-12 h-12 mb-4" />
                   <span className="text-sm font-bold uppercase tracking-widest">No matching logs found</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {logs.map((log, i) => (
                    <div key={i} className="p-4 bg-muted/10 border border-border/20 rounded-2xl flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter",
                          log.type.includes('FAILED') ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {log.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-muted-foreground/40">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground/80">{log.description}</p>
                      {Object.keys(log.data || {}).length > 0 && (
                        <pre className="text-[9px] bg-black/40 p-2 rounded-lg text-green-500/80 font-mono mt-1 border border-white/5 opacity-60">
                          {JSON.stringify(log.data, null, 1)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'state' && (
            <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 h-full">
               <div className="flex flex-col gap-2">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Raw Memory Snapshot</h4>
                 <p className="text-xs text-muted-foreground font-medium">Volcado de estado actual en el motor de persistencia local.</p>
               </div>
               <div className="flex-1 bg-[#0D0D0D] rounded-[2rem] p-8 border border-white/5 shadow-2xl relative group">
                  <div className="absolute top-4 right-6 text-[9px] font-mono font-black text-green-500/20 group-hover:text-green-500/40 transition-colors">READ_ONLY_MODE</div>
                  <pre className="text-[11px] font-mono text-green-400 overflow-auto h-full leading-relaxed custom-scrollbar">
                    {device.lastKnownState 
                      ? JSON.stringify(device.lastKnownState, null, 4)
                      : '// NULL_STATE: No telemetry data available for this entity'}
                  </pre>
               </div>
               <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 text-primary/60">
                  <Terminal className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest italic">Use this data to debug automation triggers and conditions</span>
               </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-muted/10 border-t border-border flex justify-between items-center">
           <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest italic">Operator Console Technical Audit Tool v1.0.0</span>
           <button onClick={fetchDetails} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
             <RefreshCw className="w-4 h-4" />
           </button>
        </div>

      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string; icon: React.ReactNode; highlight?: boolean }> = ({ label, value, icon, highlight }) => (
  <div className="flex flex-col gap-1.5 p-4 bg-card border border-border/40 rounded-2xl shadow-sm">
    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
      {icon} {label}
    </span>
    <span className={cn(
      "text-[10px] font-bold truncate",
      highlight ? "text-primary italic" : "text-foreground"
    )}>
      {value}
    </span>
  </div>
);

const ActionButton: React.FC<{ label: string; onClick: () => void; color: 'primary' | 'secondary' | 'accent' }> = ({ label, onClick, color }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 border",
      color === 'primary' && "bg-primary text-white border-primary-foreground/10 hover:bg-primary/90 shadow-primary/20",
      color === 'secondary' && "bg-muted text-foreground border-border hover:bg-muted/80",
      color === 'accent' && "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 shadow-secondary/10"
    )}
  >
    {label}
  </button>
);
