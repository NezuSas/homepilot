import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { humanize } from '../lib/naming-utils';
import { hasCapability } from '../lib/deviceCapabilities';
import type { SnapshotDevice, SnapshotRoom } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { CurtainDeviceTile } from './CurtainDeviceTile';
import { DashDeviceTile } from './DashDeviceTile';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off' | 'open' | 'closed' | 'opening' | 'closing';
  brightness?: number;
  current_position?: number;
  [key: string]: unknown;
}

interface DashboardRoomsSectionProps {
  activeRooms: SnapshotRoom[];
  devices: SnapshotDevice[];
  duplicateNames: Map<string, number>;
  roomProcessing: string | null;
  onRoomTurnOff: (roomId: string) => void;
  onDeviceUpdate: (updated: SnapshotDevice) => void;
  onCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  onActionExecute?: (label: string) => void;
}

const isDeviceActive = (device: SnapshotDevice): boolean => {
  const state = device.lastKnownState as DeviceState || {};

  if (hasCapability(device, 'cover')) {
    return state.state === 'open'
      || state.state === 'opening'
      || Number(state.current_position) > 0;
  }

  return state.on === true
    || state.state === 'on'
    || Number(state.brightness) > 0;
};

export const DashboardRoomsSection: React.FC<DashboardRoomsSectionProps> = ({
  activeRooms,
  devices,
  duplicateNames,
  roomProcessing,
  onRoomTurnOff,
  onDeviceUpdate,
  onCommand,
  onActionExecute,
}) => {
  const { t } = useTranslation();

  if (activeRooms.length === 0) {
    return (
      <div className="py-24 border-2 border-dashed border-border rounded-[3rem] flex flex-col items-center justify-center text-center opacity-40">
        <Cpu className="w-12 h-12 mb-4 text-muted-foreground" />
        <p className="text-sm font-black uppercase tracking-widest">{t('inbox.empty_state')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {activeRooms.map((room) => {
        const roomDevices = devices.filter((device) => device.roomId === room.id);
        const onCount = roomDevices.filter(isDeviceActive).length;

        return (
          <div key={room.id} className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-border/50 bg-card/35 p-5 shadow-depth-1 backdrop-blur-md md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
                  onCount > 0 ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground',
                )}>
                  <Cpu className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                <h3 className="truncate text-3xl font-black tracking-tighter luxury-text-gradient">{room.name}</h3>
                <span className={cn(
                  'text-[10px] font-black uppercase tracking-widest transition-colors',
                  onCount > 0 ? 'text-warning' : 'text-muted-foreground/40',
                )}>
                  {onCount > 0 ? t('dashboard.active_units', { count: onCount }) : t('dashboard.all_off')}
                </span>
              </div>
              </div>
              {onCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={roomProcessing === room.id}
                  onClick={() => onRoomTurnOff(room.id)}
                  className="text-[9px] uppercase tracking-widest px-4 py-2 bg-transparent hover:bg-danger/10 hover:text-danger border-border hover:border-danger/30 rounded-xl"
                >
                  {!roomProcessing && t('common.turn_off_all')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {roomDevices.map((device) => {
                const isCover = hasCapability(device, 'cover');
                const isDuplicateName = (duplicateNames.get(humanize(device.id, device.name)) || 0) > 1;

                return isCover ? (
                  <CurtainDeviceTile
                    key={device.id}
                    device={device}
                    roomName={room.name}
                    isDuplicateName={isDuplicateName}
                    onUpdate={onDeviceUpdate}
                    onCommand={onCommand}
                    onActionExecute={onActionExecute}
                  />
                ) : (
                  <DashDeviceTile
                    key={device.id}
                    device={device}
                    roomName={room.name}
                    isDuplicateName={isDuplicateName}
                    onUpdate={onDeviceUpdate}
                    onCommand={onCommand}
                    onActionExecute={onActionExecute}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
