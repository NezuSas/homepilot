import React from 'react';
import { Monitor, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveManagedDeviceKind } from '../lib/devicePresentation';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { CameraDeviceTile } from './CameraDeviceTile';
import { CurtainDeviceTile } from './CurtainDeviceTile';
import { DashDeviceTile } from './DashDeviceTile';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

interface ManagedDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
  onUpdate: (updated: SnapshotDevice) => void;
  onInspect: () => void;
  onControlDisplay?: () => void;
  onCommand: (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ) => Promise<SnapshotDevice | null>;
}

export const ManagedDeviceTile: React.FC<ManagedDeviceTileProps> = ({
  device,
  roomName,
  isDuplicateName,
  onUpdate,
  onInspect,
  onControlDisplay,
  onCommand,
}) => {
  const { t } = useTranslation();
  const kind = resolveManagedDeviceKind(device);

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2',
        kind === 'cover' && 'w-full max-w-curtain-manager justify-self-start',
        kind === 'camera' && 'w-full max-w-[25rem] justify-self-start',
      )}
    >
      {kind === 'smart_display' ? (
        <div className="flex min-h-device-tile flex-col justify-between rounded-card border border-border bg-card p-4 sm:min-h-device-tile-lg">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
              <Monitor className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-card-title font-semibold text-foreground">{device.name}</p>
              <p className="mt-1 text-caption text-muted-foreground">{t('inbox.smart_display.type')}</p>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 text-caption text-muted-foreground">
            <span className={cn('h-2 w-2 shrink-0 rounded-full',
              device.lastKnownState?.connectionState === 'online' ? 'bg-success' : 'bg-muted-foreground/50')} aria-hidden="true" />
            {device.lastKnownState?.connectionState === 'online'
              ? t('inbox.smart_display.online')
              : device.lastKnownState?.connectionState === 'offline'
                ? t('inbox.smart_display.offline') : t('inbox.smart_display.unknown')}
          </p>
        </div>
      ) : kind === 'camera' ? (
        <CameraDeviceTile
          device={device}
          roomName={roomName}
          isDuplicateName={isDuplicateName}
        />
      ) : kind === 'cover' ? (
        <CurtainDeviceTile
          device={device}
          roomName={roomName}
          isDuplicateName={isDuplicateName}
          onUpdate={onUpdate}
          onCommand={onCommand}
        />
      ) : (
        <DashDeviceTile
          device={device}
          roomName={roomName}
          showRoomName={false}
          isDuplicateName={isDuplicateName}
          onUpdate={onUpdate}
          onCommand={onCommand}
        />
      )}

      <Button
        type="button"
        onClick={kind === 'smart_display' ? onControlDisplay : onInspect}
        variant="outline"
        size="md"
        className="w-full border-border/60 bg-card/55 text-caption text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        {kind === 'smart_display' ? <Monitor className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        {kind === 'smart_display' ? t('inbox.smart_display.manage_controls') : t('inbox.manage_device')}
      </Button>
    </article>
  );
};
