import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Inbox,
  Loader2,
  Settings,
  Cpu,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SectionHeader } from '../components/ui/SectionHeader';
import { DeviceInspector } from '../components/DeviceInspector';
import { HomeAssistantDiscoverySection } from '../components/HomeAssistantDiscoverySection';
import { InboxDeviceTile } from '../components/InboxDeviceTile';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';

/**
 * Vista de Inbox principal para la Operator Console.
 * Soporta modos 'manager' (dispositivos asignados) y 'discovery' (dispositivos pendientes).
 */
export interface InboxViewProps {
  mode?: 'manager' | 'discovery';
}

export const InboxView: React.FC<InboxViewProps> = ({ mode = 'discovery' }) => {
  const { t } = useTranslation();
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'light' | 'switch' | 'sensor'>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'local' | 'bridged'>('all');
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const loading = useDeviceSnapshotStore((state) => state.isLoading);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const fetchData = useCallback(async () => {
    await refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceUpdate = (_deviceId: string, updated: Device) => {
    upsertDevice(updated);
  };

  // Grouping logic with strict mode filtering
  const filtered = devices.filter((d: Device) => {
    // Strict status filtering based on view mode
    if (mode === 'manager' && d.status !== 'ASSIGNED') return false;
    if (mode === 'discovery' && d.status !== 'PENDING') return false;

    const matchesType = filter === 'all' || d.type === filter;
    const isLocal = d.integrationSource === 'sonoff';
    const matchesOrigin = originFilter === 'all' || (originFilter === 'local' ? isLocal : (originFilter === 'bridged' ? !isLocal : true));
    return matchesType && matchesOrigin;
  });

  const roomsFlattened = Object.values(roomsByHome).flat();
  
  const grouped = filtered.reduce((acc: Record<string, { name: string, devices: Device[] }>, dev: Device) => {
    const isPending = dev.status === 'PENDING';
    const room = roomsFlattened.find((r: Room) => r.id === dev.roomId);
    const groupId = isPending || !room ? 'UNASSIGNED' : room.id;
    const groupName = isPending || !room ? t('inbox.rooms.unassigned') : room.name;
    
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

  const hasLocalDevices = devices.some(d => d.integrationSource === 'sonoff');

  return (
    <div className="flex flex-col gap-10">
      {hasLocalDevices && (
        <div className="flex items-center gap-2 px-4 py-2 mt-2 border border-success/20 bg-success/5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-1000 shadow-sm">
          <Cpu className="w-3.5 h-3.5 text-success/80" />
          <span className="text-[10px] font-black uppercase tracking-widest text-success/90 bg-success/10 px-2 py-0.5 rounded">{t('inbox.edge_mode_active')}</span>
          <span className="text-[10px] font-medium text-muted-foreground/60 tracking-wide border-l border-border/50 pl-3">
             {t('inbox.edge_hint')}
          </span>
        </div>
      )}

      {inspectingDeviceId && (
        <DeviceInspector 
          deviceId={inspectingDeviceId} 
          rooms={roomsFlattened}
          onClose={() => setInspectingDeviceId(null)} 
          onUpdate={(updated) => handleDeviceUpdate(inspectingDeviceId, updated)}
        />
      )}

      {/* Discovery Layer: Hidden in Manager mode */}
      {mode === 'discovery' && <HomeAssistantDiscoverySection onImported={fetchData} />}

      {/* Control Bar */}
      <SectionHeader 
        className="pb-4 border-b border-border/50"
        title={mode === 'manager' ? t('nav.system_devices') : t('nav.system_inbox')}
        subtitle={mode === 'manager' ? t('inbox.manager_subtitle') : t('inbox.discovery_subtitle')}
        icon={mode === 'manager' ? Settings : Inbox}
        action={
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Origin Filter */}
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl border border-border/50">
              {(['all', 'local', 'bridged'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setOriginFilter(o)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    originFilter === o ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:bg-background/20"
                  )}
                >
                  {o === 'all' ? t('inbox.filters.all') : (o === 'local' ? t('inbox.filters.local') : t('inbox.filters.bridged'))}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl border border-border/50 overflow-x-auto no-scrollbar max-w-full">
              {(['all', 'light', 'switch', 'sensor'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                   filter === f ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:bg-background/20"
                  )}
                >
                  {t(`inbox.filters.${f}`)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Adaptive Grid Rendering */}
      <div className="flex flex-col gap-12">
        {Array.isArray(Object.entries(grouped)) && Object.entries(grouped).map(([id, group]) => (
          <section key={id} className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 group/header">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                {group.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/30 hidden sm:block min-w-[20px]" />
                <span className="px-3 py-1 bg-muted rounded-full text-[10px] font-black border border-border opacity-50 whitespace-nowrap">
                  {t('inbox.rooms.device_count', { count: group.devices.length })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
              {Array.isArray(group.devices) && group.devices.map(device => (
                <InboxDeviceTile 
                  key={device.id} 
                  device={device} 
                  rooms={roomsByHome[device.homeId] || []}
                  onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
                  onInspect={() => setInspectingDeviceId(device.id)}
                  hideControls={mode === 'discovery'}
                />
              ))}
            </div>
          </section>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div className="py-24 border-2 border-dashed border-border/40 rounded-[3rem] flex flex-col items-center justify-center text-center bg-card/5">
             <Zap className="w-12 h-12 mb-4 text-primary opacity-20" />
             <h3 className="text-xl font-black mb-2 tracking-tight">
               {mode === 'discovery' ? t('inbox.discovery.no_entities') : t('inbox.empty_state')}
             </h3>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
               {mode === 'discovery' ? t('nav.system_inbox') : t('nav.system_devices')}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};
