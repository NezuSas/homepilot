import { Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SectionRoomCardProps {
  title: string;
  roomDeviceCount?: number;
  roomActiveCount?: number;
}

export function SectionRoomCard({ title, roomDeviceCount, roomActiveCount }: SectionRoomCardProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-section border border-border/60 bg-room-card p-3.5 text-foreground shadow-surface-card ring-1 ring-background/70 transition-all dark:border-primary/20 dark:bg-room-card-dark dark:shadow-primary-room sm:p-4">
      <div className="pointer-events-none absolute inset-0 bg-room-card-aura opacity-80 dark:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10 sm:h-11 sm:w-11"><Home className="h-room-icon w-room-icon sm:h-5 sm:w-5" /></span>
        <span className="relative rounded-full border border-border/65 bg-background/90 px-2.5 py-1 text-micro font-black uppercase tracking-control text-muted-foreground shadow-sm dark:bg-background/45 sm:text-micro">{t('dashboard.editor.sections.room_label')}</span>
      </div>
      <div className="relative min-w-0 py-2">
        <span className="block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
        <span className="mt-1 block line-clamp-2 text-micro font-black uppercase tracking-status text-muted-foreground sm:text-micro">{t('dashboard.editor.sections.room_access')}</span>
      </div>
      <div className="relative grid grid-cols-2 gap-2">
        <span className="min-w-0 rounded-2xl border border-border/65 bg-background/95 px-3 py-2 shadow-sm dark:bg-background/45"><span className="block truncate text-micro font-black uppercase tracking-control text-muted-foreground">{t('dashboard.editor.sections.room_devices')}</span><span className="mt-0.5 block truncate text-body-lg font-black text-foreground sm:text-section-title">{roomDeviceCount ?? 0}</span></span>
        <span className="min-w-0 rounded-2xl border border-primary/35 bg-primary/10 px-3 py-2 shadow-primary-room-icon ring-1 ring-primary/10"><span className="block truncate text-micro font-black uppercase tracking-control text-primary">{t('dashboard.editor.sections.room_active')}</span><span className="mt-0.5 block truncate text-body-lg font-black text-primary sm:text-section-title">{roomActiveCount ?? 0}</span></span>
      </div>
    </div>
  );
}
