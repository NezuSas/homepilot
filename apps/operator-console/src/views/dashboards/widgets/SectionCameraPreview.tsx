import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionCameraCard } from './SectionCameraCard';

interface SectionCameraPreviewProps {
  deviceId?: string;
  title: string;
  subtitle?: string;
}

function CameraMediaPlaceholder() {
  return <div className="grid h-full w-full place-items-center bg-scene-preview"><div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/25 text-white/70"><Camera className="h-9 w-9" /></div></div>;
}

export function SectionCameraPreview({ deviceId, title, subtitle }: SectionCameraPreviewProps) {
  const { t } = useTranslation();
  return <div className="relative h-full min-h-curtain-card overflow-hidden rounded-section border border-border/40 bg-card shadow-sm">{deviceId ? <SectionCameraCard deviceId={deviceId} title={title} /> : <CameraMediaPlaceholder />}<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" /><div className="absolute bottom-3 left-3 right-3"><p className="line-clamp-2 text-body font-black leading-tight text-white drop-shadow">{title}</p><p className="mt-0.5 truncate text-caption font-semibold text-white/75">{deviceId ? subtitle || t('common.unassigned') : subtitle || t('dashboard.editor.sections.camera_unassigned')}</p></div></div>;
}
