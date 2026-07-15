import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { ManagedDeviceTile } from '../components/ManagedDeviceTile';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { humanize } from '../lib/naming-utils';
import { resolveManagedDeviceKind, type ManagedDeviceKind } from '../lib/devicePresentation';

const API_URL = `${API_BASE_URL}/api/v1`;

/**
 * Vista de Inbox principal para la Operator Console.
 * Soporta modos 'manager' (dispositivos asignados) y 'discovery' (dispositivos pendientes).
 */
export interface InboxViewProps {
  mode?: 'manager' | 'discovery';
}

type DeviceFilter = 'all' | Exclude<ManagedDeviceKind, 'other'>;

export const InboxView: React.FC<InboxViewProps> = ({ mode = 'discovery' }) => {
  const { t } = useTranslation();
  const [inspectingDeviceId, setInspectingDeviceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>('all');
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

  const executeDeviceCommand = useCallback(async (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ): Promise<Device | null> => {
    const response = await apiFetch(`${API_URL}/devices/${encodeURIComponent(deviceId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: params ? { name: command, params } : command }),
    });

    return response.ok ? await response.json() as Device : null;
  }, []);

  // Grouping logic with strict mode filtering
  const filtered = useMemo(() => devices.filter((d: Device) => {
    if (mode === 'manager' && d.status !== 'ASSIGNED') return false;
    if (mode === 'discovery' && d.status !== 'PENDING') return false;

    const matchesType = filter === 'all' || resolveManagedDeviceKind(d) === filter;
    const isLocal = d.integrationSource === 'sonoff';
    const matchesOrigin = originFilter === 'all' || (originFilter === 'local' ? isLocal : !isLocal);
    return matchesType && matchesOrigin;
  }), [devices, filter, mode, originFilter]);

  const roomsFlattened = Object.values(roomsByHome).flat();
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((device) => {
      const name = humanize(device.id, device.name);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return counts;
  }, [filtered]);
  
  const grouped = filtered.reduce((acc: Record<string, { name: string, devices: Device[] }>, dev: Device) => {
    const isPending = dev.status === 'PENDING';
    const room = roomsFlattened.find((r: Room) => r.id === dev.roomId);
    const groupId = isPending || !room ? 'UNASSIGNED' : room.id;
    const groupName = isPending || !room ? t('inbox.rooms.unassigned') : room.name;
    
    if (!acc[groupId]) acc[groupId] = { name: groupName, devices: [] };
    acc[groupId].devices.push(dev);
    return acc;
  }, {} as Record<string, { name: string, devices: Device[] }>);

  if (loading && devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  const hasLocalDevices = devices.some(d => d.integrationSource === 'sonoff');

  return (
    <div className="flex flex-col gap-7 sm:gap-10">
      {hasLocalDevices && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-success/20 bg-success/5 px-4 py-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-1000 sm:flex-row sm:items-center">
          <Cpu className="w-3.5 h-3.5 text-success/80" />
          <span className="text-micro font-black uppercase tracking-widest text-success/90 bg-success/10 px-2 py-0.5 rounded">{t('inbox.edge_mode_active')}</span>
          <span className="text-micro font-medium tracking-wide text-muted-foreground/60 sm:border-l sm:border-border/50 sm:pl-3">
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
          onDeleted={() => {
            setInspectingDeviceId(null);
            void fetchData();
          }}
        />
      )}

      {/* Discovery Layer: Hidden in Manager mode */}
      {mode === 'discovery' && <HomeAssistantDiscoverySection onImported={upsertDevice} />}

      {/* Control Bar */}
      <SectionHeader 
        className="pb-4 border-b border-border/50"
        title={mode === 'manager' ? t('nav.system_devices') : t('nav.system_inbox')}
        subtitle={mode === 'manager' ? t('inbox.manager_subtitle') : t('inbox.discovery_subtitle')}
        icon={mode === 'manager' ? Settings : Inbox}
        action={
          <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            {/* Origin Filter */}
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/50 bg-muted p-1 no-scrollbar">
              {(['all', 'local', 'bridged'] as const).map(o => (
                <button
                  key={o}
                  onClick={() => setOriginFilter(o)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    originFilter === o ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:bg-background/20"
                  )}
                >
                  {o === 'all' ? t('inbox.filters.all') : (o === 'local' ? t('inbox.filters.local') : t('inbox.filters.bridged'))}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl border border-border/50 overflow-x-auto no-scrollbar max-w-full">
              {(['all', 'light', 'switch', 'cover', 'camera', 'sensor'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all whitespace-nowrap",
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
              <h3 className="text-body font-black uppercase tracking-widest flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                {group.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/30 hidden sm:block min-w-[20px]" />
                <span className="px-3 py-1 bg-muted rounded-full text-micro font-black border border-border opacity-50 whitespace-nowrap">
                  {t('inbox.rooms.device_count', { count: group.devices.length })}
                </span>
              </div>
            </div>

            <div className={cn(
              'grid gap-4 sm:gap-6',
              mode === 'manager'
                ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]'
                : 'grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
            )}>
              {Array.isArray(group.devices) && group.devices.map((device) => {
                const roomName = roomsFlattened.find((room) => room.id === device.roomId)?.name;
                const isDuplicateName = (duplicateNames.get(humanize(device.id, device.name)) || 0) > 1;

                return mode === 'manager' ? (
                  <ManagedDeviceTile
                    key={device.id}
                    device={device}
                    roomName={roomName}
                    isDuplicateName={isDuplicateName}
                    onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
                    onInspect={() => setInspectingDeviceId(device.id)}
                    onCommand={executeDeviceCommand}
                  />
                ) : (
                  <InboxDeviceTile
                    key={device.id}
                    device={device}
                    rooms={roomsByHome[device.homeId] || []}
                    onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
                    onInspect={() => setInspectingDeviceId(device.id)}
                    hideControls
                  />
                );
              })}
            </div>
          </section>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div className="py-24 border-2 border-dashed border-border/40 rounded-[3rem] flex flex-col items-center justify-center text-center bg-card/5">
             <Zap className="w-12 h-12 mb-4 text-primary opacity-20" />
             <h3 className="text-panel-title font-black mb-2 tracking-tight">
               {mode === 'discovery' ? t('inbox.discovery.no_entities') : t('inbox.empty_state')}
             </h3>
             <p className="text-micro font-black uppercase tracking-[0.4em] opacity-40">
               {mode === 'discovery' ? t('nav.system_inbox') : t('nav.system_devices')}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};
