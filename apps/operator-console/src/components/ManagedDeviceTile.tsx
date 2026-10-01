import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { disambiguate, humanize } from '../lib/naming-utils';
import { IconButton } from './ui/IconButton';

interface ManagedDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
  onInspect: () => void;
}

export const ManagedDeviceTile: React.FC<ManagedDeviceTileProps> = ({
  device,
  roomName,
  isDuplicateName,
  onInspect,
}) => {
  const { t } = useTranslation();
  const name = humanize(device.id, device.name);

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-body-compact font-semibold">{isDuplicateName ? disambiguate(name, roomName) : name}</h3>
        <p className="mt-1 break-words text-caption text-muted-foreground">{roomName || t('common.unassigned')}</p>
      </div>
      <IconButton
        icon={Settings2}
        label={`${t('inbox.manage_device')}: ${name}`}
        onClick={onInspect}
        size="lg"
      />
    </article>
  );
};
