import { useTranslation } from 'react-i18next';
import { Camera, Edit2, Trash2 } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { StatusPill } from './ui/StatusPill';
import type { NativeCamera } from '../views/nativeCameras/types';

interface Props {
  camera: NativeCamera;
  onEdit: (camera: NativeCamera) => void;
  onDelete: (id: string) => void;
}
/** Configuration summary, not a live stream. Operations remain in Espacios/Dashboard. */
export function NativeCameraSettingsCard({ camera, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  return <article className="min-w-0 space-y-3 rounded-card border border-border bg-card p-3" aria-label={camera.name}>
    <div className="flex min-w-0 flex-wrap items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
        <Camera aria-hidden className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-body font-semibold">{camera.name}</h3>
        <p className="text-caption text-muted-foreground">{t(`native_cameras.source_types.${camera.sourceType || 'onvif-ptz'}`)}</p>
      </div>
      <StatusPill variant={camera.enabled ? 'success' : 'neutral'}>
        {t(camera.enabled ? 'native_cameras.status_active' : 'native_cameras.status_inactive')}
      </StatusPill>
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
      <dt className="text-muted-foreground">{t('native_cameras.host_label')}</dt>
      <dd className="min-w-0 break-all text-right">{camera.host}</dd>
      <dt className="text-muted-foreground">{t('native_cameras.rtsp_port_label')}</dt>
      <dd className="text-right tabular-nums">{camera.rtspPort}</dd>
      <dt className="text-muted-foreground">{t('native_cameras.rtsp_path_label')}</dt>
      <dd className="min-w-0 break-all text-right">{camera.rtspPath || '/'}</dd>
    </dl>
    <div className="flex justify-end gap-1 border-t border-border pt-2">
      <IconButton size="lg" icon={Edit2} label={`${t('common.edit')}: ${camera.name}`} onClick={() => onEdit(camera)} variant="ghost" />
      <IconButton size="lg" icon={Trash2} label={`${t('common.delete')}: ${camera.name}`} onClick={() => onDelete(camera.deviceId)}
        variant="ghost" className="text-muted-foreground hover:bg-danger/10 hover:text-danger" />
    </div>
  </article>;
}
