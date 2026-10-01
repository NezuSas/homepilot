import { Camera, ChevronRight, Lightbulb, Monitor, Plug, RadioTower, Settings2, SlidersHorizontal, Thermometer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveManagedDeviceKind } from '../lib/devicePresentation';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { disambiguate, humanize } from '../lib/naming-utils';
import { Button } from './ui/Button';

interface ManagedDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
  onInspect: () => void;
  onControlDisplay?: () => void;
}

export const ManagedDeviceTile: React.FC<ManagedDeviceTileProps> = ({
  device,
  roomName,
  isDuplicateName,
  onInspect,
  onControlDisplay,
}) => {
  const { t } = useTranslation();
  const kind = resolveManagedDeviceKind(device);
  const Icon = ({ camera: Camera, cover: SlidersHorizontal, light: Lightbulb, switch: Plug,
    sensor: Thermometer, smart_display: Monitor, other: RadioTower })[kind];
  const name = humanize(device.id, device.name);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-section border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-card-title font-semibold">{isDuplicateName ? disambiguate(name, roomName) : name}</h3>
          <p className="mt-1 text-caption text-muted-foreground">{t(`device_types.${device.semanticType || device.type}`, { defaultValue: t('device_types.none') })}</p>
        </div>
      </div>
      <p className="truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</p>

      <Button
        type="button"
        onClick={onInspect}
        variant="outline"
        size="md"
        className="w-full border-border/60 bg-card/55 text-caption text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        {t('inbox.manage_device')}
      </Button>
      {kind === 'smart_display' && onControlDisplay && <Button type="button" variant="ghost" onClick={onControlDisplay} className="w-full text-caption">
        {t('inbox.smart_display.manage_controls')}<ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>}
    </article>
  );
};
