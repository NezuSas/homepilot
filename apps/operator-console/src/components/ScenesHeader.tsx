import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { SectionHeader } from './ui/SectionHeader';

interface ScenesHeaderProps {
  sceneCount: number;
  onCreateScene: () => void;
}

export const ScenesHeader: React.FC<ScenesHeaderProps> = ({ sceneCount, onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <SectionHeader
        className="mb-0"
        title={t('nav.scenes')}
        subtitle={t('scenes.header.available', { count: sceneCount })}
      />
      <Button onClick={onCreateScene} size="sm" className="w-full sm:w-auto">
        <Plus className="h-3.5 w-3.5" />
        {t('dashboard.scene_create')}
      </Button>
    </div>
  );
};
