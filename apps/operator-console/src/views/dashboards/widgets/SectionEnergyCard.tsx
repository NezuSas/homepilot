import { useTranslation } from 'react-i18next';

export function SectionEnergyCard() {
  const { t } = useTranslation();

  return (
    <div className="homepilot-dashboard-large-card flex h-full min-h-0 flex-col justify-between rounded-section border border-border/45 bg-card p-4">
      <span className="text-micro font-black uppercase tracking-label-wide text-primary">{t('dashboard.editor.sections.energy_label')}</span>
      <div><span className="text-hero-title font-black text-foreground">1.8</span><span className="ml-1 text-body font-black text-muted-foreground">kW</span></div>
      <div className="h-2 rounded-full bg-muted"><div className="h-full w-percent-64 rounded-full bg-primary" /></div>
    </div>
  );
}
