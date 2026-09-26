import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SectionSceneCardProps {
  title: string;
  subtitle?: string;
}

export function SectionSceneCard({ title, subtitle }: SectionSceneCardProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-primary/25 bg-room-card-rich p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner"><Monitor className="h-5 w-5" /></span>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-micro font-black uppercase tracking-status text-primary">{t('dashboard.editor.sections.scene_list')}</span>
      </div>
      <div className="mt-auto min-w-0">
        <span className="block text-micro font-black uppercase tracking-label-wide text-primary/80">{t('dashboard.editor.sections.scene_label')}</span>
        <span className="mt-1 block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
        <span className="mt-2 block line-clamp-2 text-micro font-semibold leading-snug text-muted-foreground">{subtitle || t('dashboard.editor.sections.scene_description')}</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/45 bg-background/35 px-3 py-2">
        <span className="text-micro font-black uppercase tracking-status text-muted-foreground">{t('dashboard.editor.sections.scene_control')}</span>
        <span className="text-micro font-black uppercase tracking-status text-primary">{t('dashboard.editor.sections.scene_one_tap')}</span>
      </div>
    </div>
  );
}
