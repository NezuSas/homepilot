import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CameraDeviceTile } from '../../../components/CameraDeviceTile';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

interface SectionCameraPreviewProps {
  device?: SnapshotDevice;
  title: string;
  subtitle?: string;
}

function CameraMediaPlaceholder() {
  return <div className="grid h-full w-full place-items-center bg-scene-preview"><div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/25 text-white/70"><Camera className="h-9 w-9" /></div></div>;
}

export function SectionCameraPreview({ device, title, subtitle }: SectionCameraPreviewProps) {
  const { t } = useTranslation();
  if (device) {
    return <CameraDeviceTile device={device} title={title} roomName={subtitle} dashboard />;
  }

  return <div className="relative h-full min-h-curtain-card overflow-hidden rounded-section border border-border/40 bg-card">
    <div className="absolute inset-0"><CameraMediaPlaceholder /></div>
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
      <p className="line-clamp-2 text-card-title font-bold leading-tight text-white drop-shadow">{title}</p>
      <p className="mt-1 truncate text-caption font-semibold text-white/80">{subtitle || t('dashboard.editor.sections.camera_unassigned')}</p>
    </div>
  </div>;
}
