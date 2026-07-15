import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface AutomationsHeaderProps {
  activeCount: number;
  onCreate: () => void;
}

export const AutomationsHeader: React.FC<AutomationsHeaderProps> = ({ activeCount, onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
      <div>
        <h2 className="text-view-title font-black tracking-tight leading-tight sm:text-display-title mb-2">{t('automations.header.title')}</h2>
        <p className="text-body font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
          {t('automations.header.subtitle', { count: activeCount })}
        </p>
      </div>
      <button
        onClick={onCreate}
        className="bg-primary text-primary-foreground px-10 py-5 rounded-panel font-black text-caption uppercase tracking-label transition-all hover:scale-[1.03] active:scale-95 premium-glow shadow-primary/20 flex items-center gap-4"
      >
        <Plus className="w-6 h-6" />
        {t('automations.create_rule')}
      </button>
    </div>
  );
};
