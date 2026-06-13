import React from 'react';
import { useTranslation } from 'react-i18next';

export const AssistantRecommendationsHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4 px-2">
      <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">
        {t('assistant.top_recommendations')}
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-muted to-transparent" />
    </div>
  );
};
