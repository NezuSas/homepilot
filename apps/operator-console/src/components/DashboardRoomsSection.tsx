import React from 'react';
import { useTranslation } from 'react-i18next';
import { House, Power } from 'lucide-react';
import { cn } from '../lib/utils';
import { humanize } from '../lib/naming-utils';
import { hasCapability } from '../lib/deviceCapabilities';
import type { SnapshotDevice, SnapshotRoom } from '../stores/useDeviceSnapshotStore';
import type { HomeMode } from '../types';
import { Button } from './ui/Button';
import { CurtainDeviceTile } from './CurtainDeviceTile';
import { DashDeviceTile } from './DashDeviceTile';
import { CameraDeviceTile } from './CameraDeviceTile';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off' | 'open' | 'closed' | 'opening' | 'closing';
  brightness?: number;
  current_position?: unknown;
  position?: unknown;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DashboardRoomsSectionProps {
  activeRooms: SnapshotRoom[];
  mode: HomeMode;
  devices: SnapshotDevice[];
  duplicateNames: Map<string, number>;
  roomProcessing: string | null;
  onRoomTurnOff: (roomId: string) => void;
  onRoomLightsTurnOff: (roomId: string) => void;
  onDeviceUpdate: (updated: SnapshotDevice) => void;
  onCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  onActionExecute?: (label: string) => void;
}

const isDeviceActive = (device: SnapshotDevice): boolean => {
  const state = device.lastKnownState as DeviceState || {};

  if (hasCapability(device, 'cover')) {
    const parsePosition = (value: unknown): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      return Math.min(100, Math.max(0, parsed));
    };
    const position = parsePosition(state.current_position)
      ?? parsePosition(state.position)
      ?? parsePosition(state.attributes?.current_position)
      ?? parsePosition(state.attributes?.position);
    const functionalPosition = position !== undefined && device.invertState ? 100 - position : position;

    if (functionalPosition !== undefined) {
      return functionalPosition > 0;
    }

    return state.state === 'open'
      || state.state === 'opening';
  }

  return state.on === true
    || state.state === 'on'
    || Number(state.brightness) > 0;
};

export const DashboardRoomsSection: React.FC<DashboardRoomsSectionProps> = ({
  activeRooms,
  mode,
  devices,
  duplicateNames,
  roomProcessing,
  onRoomTurnOff,
  onRoomLightsTurnOff,
  onDeviceUpdate,
  onCommand,
  onActionExecute,
}) => {
  const { t } = useTranslation();

  if (activeRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border py-20 text-center text-muted-foreground">
        <House className="mb-4 h-10 w-10" />
        <p className="text-body font-semibold">{t('inbox.empty_state')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeRooms.map((room) => {
        const roomDevices = devices.filter((device) => device.roomId === room.id);
        const orderedRoomDevices = mode === 'relax'
          ? roomDevices
          : [...roomDevices].sort((left, right) => Number(isDeviceActive(right)) - Number(isDeviceActive(left)));
        const onCount = roomDevices.filter(isDeviceActive).length;
        const activeLightCount = roomDevices.filter((device) => (
          isDeviceActive(device)
          && (device.semanticType === 'light' || device.type === 'light' || hasCapability(device, 'light'))
        )).length;

        return (
          <section key={room.id} className="animate-in fade-in slide-in-from-bottom-6 rounded-panel border border-border/60 bg-card/70 p-3 shadow-depth-1 duration-500 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border',
                  onCount > 0 ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground',
                )}>
                  <House className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                <h3 className="truncate text-section-title font-semibold tracking-tight text-foreground">{room.name}</h3>
                <span className={cn(
                  'text-caption font-medium transition-colors',
                  onCount > 0 ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {onCount > 0 ? t('dashboard.active_units', { count: onCount }) : t('dashboard.all_off')}
                </span>
              </div>
              </div>
              {onCount > 0 && (
                <div className="flex w-full flex-col gap-2 min-[420px]:flex-row md:w-auto">
                  {activeLightCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={roomProcessing === `room_lights_${room.id}`}
                      onClick={() => onRoomLightsTurnOff(room.id)}
                      className="w-full gap-2 rounded-pill border-border bg-background/25 px-4 text-caption font-semibold hover:border-warning/30 hover:bg-warning/10 hover:text-warning md:w-auto"
                    >
                      {roomProcessing !== `room_lights_${room.id}` && <Power className="h-3.5 w-3.5" />}
                      {roomProcessing !== `room_lights_${room.id}` && t('dashboard.turn_off_lights')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={roomProcessing === room.id}
                    onClick={() => onRoomTurnOff(room.id)}
                    className="w-full gap-2 rounded-pill border-border bg-background/25 px-4 text-caption font-semibold hover:border-danger/30 hover:bg-danger/10 hover:text-danger md:w-auto"
                  >
                    {roomProcessing !== room.id && <Power className="h-3.5 w-3.5" />}
                    {roomProcessing !== room.id && t('common.turn_off_all')}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {orderedRoomDevices.map((device) => {
                const isCover = hasCapability(device, 'cover');
                const isCamera = hasCapability(device, 'camera');
                const isDuplicateName = (duplicateNames.get(humanize(device.id, device.name)) || 0) > 1;

                return isCamera ? (
                  <CameraDeviceTile
                    key={device.id}
                    device={device}
                    roomName={room.name}
                    isDuplicateName={isDuplicateName}
                  />
                ) : isCover ? (
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
          </section>
        );
      })}
    </div>
  );
};
