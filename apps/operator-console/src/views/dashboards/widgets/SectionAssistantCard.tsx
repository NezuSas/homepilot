import { useTranslation } from 'react-i18next';
import { getDashboardIconComponent } from '../components/IconPicker';
import { getDefaultIcon, normalizeKind, type SectionCardIcon, type SectionCardKind } from './sectionCardCatalog';

interface SectionAssistantCardProps {
  kind: SectionCardKind;
  title: string;
  icon?: SectionCardIcon;
}

export function SectionAssistantCard({ kind, title, icon }: SectionAssistantCardProps) {
  const { t } = useTranslation();
  const Icon = getDashboardIconComponent(icon ?? getDefaultIcon(normalizeKind(kind)));

  return (
    <div className="homepilot-dashboard-large-card relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-border/45 bg-room-card-quiet p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner"><Icon className="h-5 w-5" /></span>
        <span className="rounded-full border border-border/45 bg-background/45 px-2 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">{t('dashboard.editor.sections.assistant_badge')}</span>
      </div>
      <div className="mt-auto min-w-0">
        <span className="block line-clamp-2 text-body font-black leading-tight text-foreground">{title}</span>
        <span className="mt-1 block line-clamp-2 text-micro font-black uppercase tracking-label text-muted-foreground">{t('dashboard.editor.sections.smart_summary')}</span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-micro font-black uppercase tracking-control text-muted-foreground"><span>{t('dashboard.editor.sections.signals')}</span><span className="text-primary">{t('dashboard.editor.sections.ready')}</span></div>
        <div className="h-2 rounded-full bg-muted/70"><div className="h-full w-percent-88 rounded-full bg-primary" /></div>
      </div>
    </div>
  );
}
