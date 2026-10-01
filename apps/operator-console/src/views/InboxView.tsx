import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Inbox,
  Settings,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SectionHeader } from '../components/ui/SectionHeader';
import { DeviceInspector } from '../components/DeviceInspector';
import { HomeAssistantDiscoverySection } from '../components/HomeAssistantDiscoverySection';
import { InboxDeviceTile } from '../components/InboxDeviceTile';
import { ManagedDeviceTile } from '../components/ManagedDeviceTile';
import { SmartDisplayControls } from '../components/SmartDisplayControls';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { DeviceManagerSkeleton, DiscoverySkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { humanize } from '../lib/naming-utils';
import { resolveManagedDeviceKind, type ManagedDeviceKind } from '../lib/devicePresentation';
import { isDeviceUnavailable } from '../lib/deviceAvailability';

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
  const [controllingDisplayId, setControllingDisplayId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'local' | 'bridged'>('all');
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const loading = useDeviceSnapshotStore((state) => state.isLoading);
  const [initialSettled, setInitialSettled] = useState(() => useDeviceSnapshotStore.getState().lastUpdatedAt !== null);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const fetchData = useCallback(async () => {
    await refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    let active = true;
    void fetchData().finally(() => { if (active) setInitialSettled(true); });
    return () => { active = false; };
  }, [fetchData]);

  const handleDeviceUpdate = (_deviceId: string, updated: Device) => {
    upsertDevice(updated);
  };

  // Grouping logic with strict mode filtering
  const filtered = useMemo(() => devices.filter((d: Device) => {
    if (mode === 'manager' && d.status !== 'ASSIGNED') return false;
    if (mode === 'discovery' && d.status !== 'PENDING') return false;
    if (mode === 'discovery' && isDeviceUnavailable(d)) return false;

    const matchesType = filter === 'all' || resolveManagedDeviceKind(d) === filter;
    const isLocal = d.integrationSource === 'sonoff' || d.integrationSource === 'android-display';
    const matchesOrigin = originFilter === 'all' || (originFilter === 'local' ? isLocal : !isLocal);
    return matchesType && matchesOrigin;
  }), [devices, filter, mode, originFilter]);

  const roomsFlattened = Object.values(roomsByHome).flat();
  const controllingDisplay = controllingDisplayId
    ? devices.find((device) => device.id === controllingDisplayId) : undefined;
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

  const initialLoading = useInitialLoading(!initialSettled || loading);
  if (initialLoading) {
    return mode === 'manager' ? <DeviceManagerSkeleton label={t('common.loading')} /> : <DiscoverySkeleton label={t('common.loading')} />;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {inspectingDeviceId && (
        <DeviceInspector 
          deviceId={inspectingDeviceId} 
          configurationOnly={mode === 'manager'}
          rooms={roomsFlattened}
          onClose={() => setInspectingDeviceId(null)} 
          onControlDisplay={devices.find(device => device.id === inspectingDeviceId && resolveManagedDeviceKind(device) === 'smart_display') ? () => {
            setControllingDisplayId(inspectingDeviceId);
            setInspectingDeviceId(null);
          } : undefined}
          onUpdate={(updated) => handleDeviceUpdate(inspectingDeviceId, updated)}
          onDeleted={() => {
            setInspectingDeviceId(null);
            void fetchData();
          }}
        />
      )}

      {controllingDisplay && (
        <SmartDisplayControls
          device={controllingDisplay}
          onClose={() => setControllingDisplayId(null)}
        />
      )}

      {/* Discovery Layer: Hidden in Manager mode */}
      {mode === 'discovery' && <HomeAssistantDiscoverySection onImported={upsertDevice} />}

      {/* Control Bar */}
      <SectionHeader
        level="view"
        className="sm:items-center"
        title={mode === 'manager' ? t('nav.system_devices') : t('nav.system_inbox')}
        icon={mode === 'manager' ? Settings : Inbox}
        action={
          <div className="ml-auto grid w-full max-w-80 grid-cols-2 gap-2 sm:w-80">
            {/* Origin Filter */}
            <SearchableSelectField
              value={originFilter}
              onChange={value => {
                if (value === 'all' || value === 'local' || value === 'bridged') setOriginFilter(value);
              }}
              label={t('inbox.filters.origin_label')}
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
            <SearchableSelectField
              value={filter}
              onChange={value => {
                if (value === 'all' || value === 'light' || value === 'switch' || value === 'cover' || value === 'camera' || value === 'sensor' || value === 'smart_display') setFilter(value);
              }}
              label={t('inbox.filters.type_label')}
              options={(['all', 'light', 'switch', 'cover', 'camera', 'sensor', 'smart_display'] as const).map((value) => ({
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
                ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]'
                : 'grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]',
            )}>
              {Array.isArray(group.devices) && group.devices.map((device) => {
                const isDuplicateName = (duplicateNames.get(humanize(device.id, device.name)) || 0) > 1;

                return mode === 'manager' ? (
                  <ManagedDeviceTile
                    key={device.id}
                    device={device}
                    isDuplicateName={isDuplicateName}
                    onInspect={() => setInspectingDeviceId(device.id)}
                  />
                ) : (
                  <InboxDeviceTile
                    key={device.id}
                    device={device}
                    rooms={roomsByHome[device.homeId] || []}
                    onUpdate={(updated) => handleDeviceUpdate(device.id, updated)}
                    onInspect={() => setInspectingDeviceId(device.id)}
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
