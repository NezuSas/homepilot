import { useTranslation } from 'react-i18next';
import { Camera, Edit2, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
import { IconButton } from './ui/IconButton';
import { StatusPill } from './ui/StatusPill';
import type { NativeCamera } from '../views/nativeCameras/types';

interface Props {
  camera: NativeCamera;
  onEdit: (camera: NativeCamera) => void;
  onDelete: (id: string) => void;
}
/** One row to recognise a camera; port and path live in the edit form. Live playback stays in Espacios/Dashboard. */
export function NativeCameraSettingsCard({ camera, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  return <Card variant="flat" as="article" className="flex items-center gap-3 p-3" aria-label={camera.name}>
    <div className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
      <Camera aria-hidden className="size-5" />
    </div>
    <div className="min-w-0 flex-1">
      <Heading variant="card" className="truncate">{camera.name}</Heading>
      <p className="truncate text-caption text-muted-foreground">
        <span className="font-data">{camera.host}</span> · {t(`native_cameras.source_types.${camera.sourceType || 'onvif-ptz'}`)}
      </p>
      {!camera.enabled && <StatusPill variant="neutral" className="mt-1">{t('native_cameras.status_inactive')}</StatusPill>}
    </div>
    <div className="flex shrink-0 gap-1">
      <IconButton size="lg" icon={Edit2} label={`${t('common.edit')}: ${camera.name}`} onClick={() => onEdit(camera)} variant="ghost" />
      <IconButton size="lg" icon={Trash2} label={`${t('common.delete')}: ${camera.name}`} onClick={() => onDelete(camera.deviceId)}
        variant="ghost" className="text-muted-foreground hover:bg-danger/10 hover:text-danger" />
    </div>
  </Card>;
}
