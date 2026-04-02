import React, { useEffect, useState, useCallback } from 'react';
import { Server, Inbox, RadioTower, Box, CheckCircle2, AlertCircle, Loader2, ArrowRight, Power, RefreshCw } from 'lucide-react';
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
}

interface Room {
  id: string;
  name: string;
  homeId: string;
}

/**
 * Vista principal de Gestión de Dispositivos (Inbox / Devices View).
 * Permite la asignación de dispositivos nuevos y el control de dispositivos ya configurados.
 */
export const InboxView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex flex-col gap-10">
      
      {/* Sección Inbo / Pendientes */}
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
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const DeviceCard: React.FC<{ device: Device; onUpdate?: (updated: Device) => void }> = ({ device, onUpdate }) => {
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
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">{device.externalId}</span>
          </div>
        </div>
        {isAssigned ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : (
          <span className="px-2.5 py-1 bg-primary/20 text-primary text-[10px] uppercase font-bold tracking-wider rounded-md">
            Pending
          </span>
        )}
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
