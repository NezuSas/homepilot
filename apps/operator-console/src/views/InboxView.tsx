import React, { useEffect, useState } from 'react';
import { Server, Inbox, RadioTower, Box, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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

export const InboxView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetch(`${API_URL}/devices`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al recuperar dispositivos');
        return res.json();
      })
      .then((data) => {
        setDevices(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Sincronizando estado de dispositivos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive bg-destructive/10 rounded-xl border border-dashed border-destructive/50">
        <AlertCircle className="w-8 h-8 mb-4 border-destructive" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  const pendingDevices = devices.filter(d => d.status === 'PENDING');
  const assignedDevices = devices.filter(d => d.status === 'ASSIGNED');

  return (
    <div className="flex flex-col gap-10">
      
      {/* Inbox Section */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Device Inbox
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {pendingDevices.length}
            </span>
          </h3>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {pendingDevices.length === 0 ? (
            <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
              El Inbox está vacío. No hay dispositivos pendientes de asignación en la red.
            </div>
          ) : (
            pendingDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

      {/* Assigned Devices Section */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between border-t border-border pt-8">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            <Server className="w-4 h-4" />
            Assigned Devices
            <span className="bg-muted text-foreground px-2 py-0.5 rounded-full text-[10px]">
              {assignedDevices.length}
            </span>
          </h3>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {assignedDevices.length === 0 ? (
             <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
               No hay dispositivos asignados a la topología estructural actual.
             </div>
          ) : (
            assignedDevices.map(device => <DeviceCard key={device.id} device={device} />)
          )}
        </div>
      </section>

    </div>
  );
};

const DeviceCard: React.FC<{ device: Device }> = ({ device }) => {
  const isAssigned = device.status === 'ASSIGNED';
  return (
    <div className="flex flex-col p-5 border border-border rounded-xl bg-card shadow-sm hover:border-primary/40 transition-all group">
      
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-center gap-4">
          <div className={cn(
             "p-3 rounded-lg transition-colors",
             isAssigned ? "bg-muted text-muted-foreground group-hover:text-foreground" : "bg-primary/10 text-primary"
          )}>
            <RadioTower className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-base leading-none mb-1.5">{device.name}</span>
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">{device.externalId}</span>
          </div>
        </div>
        {isAssigned ? (
           <CheckCircle2 className="w-5 h-5 text-muted-foreground opacity-50" />
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
         <div className="flex flex-col gap-1 col-span-2 mt-1">
           <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider">Internal Node ID</span>
           <span className="font-mono text-[10px] text-foreground opacity-80">{device.id}</span>
         </div>
         {isAssigned && device.roomId && (
          <div className="flex flex-col gap-1 col-span-2 pt-2 border-t border-border/50 mt-1">
            <span className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider">Room Allocation</span>
            <span className="font-mono text-[10px] text-foreground opacity-80 flex items-center gap-1.5 mt-0.5">
              <Box className="w-3 h-3 text-muted-foreground" />
              {device.roomId}
            </span>
          </div>
         )}
      </div>

      <div className="mt-auto">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Last Known State Snapshot:</span>
        <pre className="bg-[#0D0D0D] text-green-400 p-3 rounded-lg text-[10px] font-mono overflow-x-auto border border-white/5 shadow-inner">
          {device.lastKnownState 
            ? JSON.stringify(device.lastKnownState, null, 2)
            : '// No telemetry received yet...'}
        </pre>
      </div>

    </div>
  );
};
