import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface AutomationsEmptyStateProps {
  onCreate: () => void;
}

export const AutomationsEmptyState: React.FC<AutomationsEmptyStateProps> = ({ onCreate }) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Zap}
      title={t('automations.empty_state.title')}
      description={t('automations.empty_state.description')}
      action={
        <Button size="sm" onClick={onCreate} className="gap-2 text-micro uppercase tracking-widest">
          {t('automations.create_rule')} <ArrowRight className="h-4 w-4" />
        </Button>
      }
    />
  );
};
