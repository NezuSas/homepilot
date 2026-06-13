import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Zap } from 'lucide-react';

interface AutomationsEmptyStateProps {
  onCreate: () => void;
}

export const AutomationsEmptyState: React.FC<AutomationsEmptyStateProps> = ({ onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-card/10 border-4 border-dashed border-border/20 rounded-[4rem]">
      <div className="p-12 bg-muted/20 rounded-full mb-8">
        <Zap className="w-16 h-16 text-muted-foreground opacity-20" />
      </div>
      <h3 className="text-3xl font-black tracking-tighter mb-4">{t('automations.empty_state.title')}</h3>
      <p className="text-muted-foreground max-w-sm font-medium mb-12 opacity-60 leading-relaxed">
        {t('automations.empty_state.description')}
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs group"
      >
        {t('automations.create_rule')} <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
      </button>
    </div>
  );
};
