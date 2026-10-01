import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { disambiguate, humanize } from '../lib/naming-utils';
import { IconButton } from './ui/IconButton';

interface ManagedDeviceTileProps {
  device: SnapshotDevice;
  isDuplicateName?: boolean;
  onInspect: () => void;
}

export const ManagedDeviceTile: React.FC<ManagedDeviceTileProps> = ({
  device,
  isDuplicateName,
  onInspect,
}) => {
  const { t } = useTranslation();
  const name = humanize(device.id, device.name);

  return (
    <article className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-body-compact font-semibold">{isDuplicateName ? disambiguate(name, device.externalId || device.id) : name}</h3>
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
