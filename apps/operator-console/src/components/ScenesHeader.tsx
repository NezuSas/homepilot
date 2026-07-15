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
    <div className="flex items-center justify-between pb-4 border-b border-border/40">
      <div className="flex flex-col">
        <h2 className="text-view-title font-black tracking-tight sm:text-display-title">{t('nav.scenes')}</h2>
        <p className="text-caption font-bold text-muted-foreground opacity-50 uppercase tracking-widest mt-1">
          {t('scenes.header.available', { count: sceneCount })}
        </p>
      </div>
      <Button onClick={onCreateScene} size="lg" className="uppercase tracking-wider premium-glow">
        <Plus className="w-5 h-5" />
        {t('dashboard.scene_create')}
      </Button>
    </div>
  );
};
