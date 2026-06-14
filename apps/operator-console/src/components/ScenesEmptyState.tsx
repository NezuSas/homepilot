import React from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface ScenesEmptyStateProps {
  onCreateScene: () => void;
}

export const ScenesEmptyState: React.FC<ScenesEmptyStateProps> = ({ onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Monitor}
      title={t('scenes.empty_title')}
      description={t('scenes.empty_description')}
      action={
        <Button size="sm" onClick={onCreateScene} className="gap-2 text-[10px] uppercase tracking-widest">
          {t('dashboard.scene_create')} <Zap className="h-4 w-4" />
        </Button>
      }
    />
  );
};
