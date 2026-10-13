import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';

interface AutomationsHeaderProps {
  activeCount: number;
  totalCount: number;
  onCreate: () => void;
}

export const AutomationsHeader: React.FC<AutomationsHeaderProps> = ({ activeCount, totalCount, onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Heading as="h2" variant="section" className="sr-only">{t('automations.header.title')}</Heading>
        <p className="text-body-compact text-muted-foreground">{t('automations.header.summary', { active: activeCount, count: totalCount })}</p>
      </div>
      <Button onClick={onCreate} size="sm" className="w-full sm:w-auto">
        <Plus className="h-3.5 w-3.5" />
        {t('automations.create_rule')}
      </Button>
    </div>
  );
};
