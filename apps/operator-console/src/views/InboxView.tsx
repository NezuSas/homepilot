import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Inbox,
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
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { LoadingState } from '../components/ui/LoadingState';
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
    return <LoadingState label={t('common.loading')} className="min-h-empty-sm" size="md" />;
  }

  const hasLocalDevices = devices.some(d => d.integrationSource === 'sonoff');

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
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
        className="mb-4 border-b border-border/50 pb-3 sm:!flex-col sm:!items-start sm:!justify-start sm:gap-3"
        title={mode === 'manager' ? t('nav.system_devices') : t('nav.system_inbox')}
        icon={mode === 'manager' ? Settings : Inbox}
        action={
          <div className="grid w-full min-w-0 gap-2 min-[520px]:w-[min(100%,44rem)] min-[520px]:grid-cols-[minmax(15rem,1fr)_minmax(20rem,1.5fr)]">
            {/* Origin Filter */}
            <SegmentedControl
              value={originFilter}
              onChange={setOriginFilter}
              label={t('inbox.filters.origin_label')}
              className="grid w-full grid-cols-3 gap-1 rounded-xl p-1"
              optionClassName="h-8 min-h-0 px-1 text-nano font-semibold tracking-normal [&>span]:whitespace-nowrap"
              options={(['all', 'local', 'bridged'] as const).map((value) => ({
                value,
                label: value === 'all'
                  ? t('inbox.filters.all')
                  : value === 'local'
                    ? t('inbox.filters.local')
                    : t('inbox.filters.bridged'),
              }))}
            />

            {/* Type Filter */}
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              label={t('inbox.filters.type_label')}
              className="grid w-full grid-cols-2 gap-1 rounded-xl p-1"
              optionClassName="h-8 min-h-0 px-2 text-micro font-semibold tracking-normal [&>span]:whitespace-nowrap"
              options={(['all', 'light', 'switch', 'cover', 'camera', 'sensor'] as const).map((value) => ({
                value,
                label: t(`inbox.filters.${value}`),
              }))}
            />
          </div>
        }
      />

      {/* Adaptive Grid Rendering */}
      <div className="flex flex-col gap-8">
        {Array.isArray(Object.entries(grouped)) && Object.entries(grouped).map(([id, group]) => (
          <section key={id} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 group/header">
              <h3 className="text-body font-black uppercase tracking-widest flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-primary-pill" />
                {group.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/30 hidden sm:block min-w-5" />
                <span className="px-3 py-1 bg-muted rounded-full text-micro font-black border border-border opacity-50 whitespace-nowrap">
                  {t('inbox.rooms.device_count', { count: group.devices.length })}
                </span>
              </div>
            </div>

            <div className={cn(
              'grid gap-3 sm:gap-4',
              mode === 'manager'
                ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]'
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
          <div className="py-12 border border-dashed border-border/40 rounded-card flex flex-col items-center justify-center text-center bg-card/5">
             <Zap className="w-12 h-12 mb-4 text-primary opacity-20" />
             <h3 className="text-panel-title font-black mb-2 tracking-tight">
               {mode === 'discovery' ? t('inbox.discovery.no_entities') : t('inbox.empty_state')}
             </h3>
             <p className="text-micro font-black uppercase tracking-label-hero opacity-40">
               {mode === 'discovery' ? t('nav.system_inbox') : t('nav.system_devices')}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};
