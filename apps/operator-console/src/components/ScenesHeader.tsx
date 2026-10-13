import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';

interface ScenesHeaderProps {
  sceneCount: number;
  onCreateScene: () => void;
}

export const ScenesHeader: React.FC<ScenesHeaderProps> = ({ sceneCount, onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Heading as="h2" variant="section" className="sr-only">{t('nav.scenes')}</Heading>
        <p className="text-body-compact text-muted-foreground">{t('scenes.header.available', { count: sceneCount })}</p>
      </div>
      <Button onClick={onCreateScene} size="sm" className="w-full sm:w-auto">
        <Plus className="h-3.5 w-3.5" />
        {t('dashboard.scene_create')}
      </Button>
    </div>
  );
};
