import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

interface AutomationsEmptyStateProps {
  hasActiveTimers?: boolean;
}

export const AutomationsEmptyState: React.FC<AutomationsEmptyStateProps> = ({ hasActiveTimers = false }) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      variant="collection"
      icon={Zap}
      title={t(hasActiveTimers ? 'automations.empty_state.timers_only_title' : 'automations.empty_state.title')}
      description={t(hasActiveTimers ? 'automations.empty_state.timers_only_description' : 'automations.empty_state.description')}
    />
  );
};
