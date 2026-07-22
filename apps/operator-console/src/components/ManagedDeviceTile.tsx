import React from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveManagedDeviceKind } from '../lib/devicePresentation';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { CameraDeviceTile } from './CameraDeviceTile';
import { CurtainDeviceTile } from './CurtainDeviceTile';
import { DashDeviceTile } from './DashDeviceTile';
import { Button } from './ui/Button';

interface ManagedDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
  onUpdate: (updated: SnapshotDevice) => void;
  onInspect: () => void;
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
  onCommand,
}) => {
  const { t } = useTranslation();
  const kind = resolveManagedDeviceKind(device);

  return (
    <article className="flex min-w-0 flex-col gap-2">
      {kind === 'camera' ? (
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
          isDuplicateName={isDuplicateName}
          onUpdate={onUpdate}
          onCommand={onCommand}
        />
      )}

      <Button
        type="button"
        onClick={onInspect}
        variant="outline"
        size="md"
        className="w-full border-border/60 bg-card/55 text-caption text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        <Settings2 className="h-4 w-4" />
        {t('inbox.manage_device')}
      </Button>
    </article>
  );
};
