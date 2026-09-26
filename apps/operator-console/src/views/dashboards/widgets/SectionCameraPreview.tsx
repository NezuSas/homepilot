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

  return <div className="flex h-full min-h-curtain-card flex-col overflow-hidden rounded-card border border-border bg-card">
    <div className="min-h-0 flex-1"><CameraMediaPlaceholder /></div>
    <div className="border-t border-border/50 p-3 sm:p-4">
      <p className="truncate text-card-title font-semibold text-foreground">{title}</p>
      <p className="mt-1 truncate text-caption text-muted-foreground">{subtitle || t('dashboard.editor.sections.camera_unassigned')}</p>
    </div>
  </div>;
}
