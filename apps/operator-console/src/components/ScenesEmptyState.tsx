import React from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Zap } from 'lucide-react';

interface ScenesEmptyStateProps {
  onCreateScene: () => void;
}

export const ScenesEmptyState: React.FC<ScenesEmptyStateProps> = ({ onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-card/10 border-4 border-dashed border-border/20 rounded-[4rem]">
      <div className="p-10 bg-muted/20 rounded-full mb-8">
        <Monitor className="w-16 h-16 text-muted-foreground opacity-20" />
      </div>
      <h3 className="text-2xl font-black tracking-tighter mb-4">{t('scenes.empty_title')}</h3>
      <p className="text-muted-foreground max-w-sm font-medium mb-12 opacity-60">
        {t('scenes.empty_description')}
      </p>
      <button
        onClick={onCreateScene}
        className="group flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs"
      >
        {t('dashboard.scene_create')} <Zap className="w-4 h-4 group-hover:animate-bounce" />
      </button>
    </div>
  );
};
