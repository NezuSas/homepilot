import React from 'react';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

export const ScenesEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <EmptyState
      variant="collection"
      icon={Home}
      title={t('scenes.empty_title')}
      description={t('scenes.empty_description')}
    />
  );
};
