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
  state?: 'on' | 'off';
  brightness?: number;
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
        const onCount = roomDevices.filter((device) => {
          const state = device.lastKnownState as DeviceState || {};
          return state.on === true || state.state === 'on' || Number(state.brightness) > 0;
        }).length;

        return (
          <div key={room.id} className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center justify-between mb-8 px-2 border-l-4 border-muted-foreground/10 pl-6">
              <div>
                <h3 className="text-3xl font-black tracking-tighter luxury-text-gradient">{room.name}</h3>
                <span className={cn(
                  'text-[10px] font-black uppercase tracking-widest transition-colors',
                  onCount > 0 ? 'text-warning' : 'text-muted-foreground/40',
                )}>
                  {onCount > 0 ? t('dashboard.active_units', { count: onCount }) : t('dashboard.all_off')}
                </span>
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

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 grid-auto-rows-[auto]">
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
