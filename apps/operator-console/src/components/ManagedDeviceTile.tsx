import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { disambiguate, humanize } from '../lib/naming-utils';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
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
    <Card variant="flat" as="article" className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <Heading variant="item">{isDuplicateName ? disambiguate(name, device.externalId || device.id) : name}</Heading>
      </div>
      <IconButton
        icon={Settings2}
        label={`${t('inbox.manage_device')}: ${name}`}
        onClick={onInspect}
        size="lg"
      />
    </Card>
  );
};
