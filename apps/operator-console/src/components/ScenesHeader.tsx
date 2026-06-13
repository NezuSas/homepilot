import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface ScenesHeaderProps {
  sceneCount: number;
  onCreateScene: () => void;
}

export const ScenesHeader: React.FC<ScenesHeaderProps> = ({ sceneCount, onCreateScene }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between pb-4 border-b border-border/40">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black tracking-tighter">{t('nav.scenes')}</h2>
        <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest mt-1">
          {t('scenes.header.available', { count: sceneCount })}
        </p>
      </div>
      <button
        onClick={onCreateScene}
        className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 premium-glow shadow-primary/20"
      >
        <Plus className="w-5 h-5" />
        {t('dashboard.scene_create')}
      </button>
    </div>
  );
};
