import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { SectionHeader } from './ui/SectionHeader';

interface AutomationsHeaderProps {
  activeCount: number;
  onCreate: () => void;
}

export const AutomationsHeader: React.FC<AutomationsHeaderProps> = ({ activeCount, onCreate }) => {
  const { t } = useTranslation();

  return (
    <SectionHeader
      title={t('automations.header.title')}
      subtitle={t('automations.header.subtitle', { count: activeCount })}
      className="mb-0 gap-3 border-b border-border/50 pb-4 sm:justify-between"
      action={
        <Button onClick={onCreate} size="sm" className="w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          {t('automations.create_rule')}
        </Button>
      }
    />
  );
};
