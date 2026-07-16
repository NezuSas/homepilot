import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

interface AutomationsHeaderProps {
  activeCount: number;
  onCreate: () => void;
}

export const AutomationsHeader: React.FC<AutomationsHeaderProps> = ({ activeCount, onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-section-title font-bold tracking-tight">{t('automations.header.title')}</h2>
        <p className="mt-1 text-micro font-semibold uppercase tracking-label text-muted-foreground/60">
          {t('automations.header.subtitle', { count: activeCount })}
        </p>
      </div>
      <Button
        onClick={onCreate}
        size="md"
        className="w-full uppercase tracking-label sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        {t('automations.create_rule')}
      </Button>
    </div>
  );
};
