import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

interface ScenesHeaderProps {
  sceneCount: number;
  onCreateScene: () => void;
}

export const ScenesHeader: React.FC<ScenesHeaderProps> = ({ sceneCount, onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col">
        <h2 className="text-section-title font-bold tracking-tight">{t('nav.scenes')}</h2>
        <p className="mt-1 text-micro font-semibold uppercase tracking-label text-muted-foreground/60">
          {t('scenes.header.available', { count: sceneCount })}
        </p>
      </div>
      <Button onClick={onCreateScene} size="md" className="w-full uppercase tracking-label sm:w-auto">
        <Plus className="h-4 w-4" />
        {t('dashboard.scene_create')}
      </Button>
    </div>
  );
};
