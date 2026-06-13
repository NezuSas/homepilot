import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

export const AssistantEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 border-2 border-dashed border-muted rounded-3xl bg-muted/5">
      <CheckCircle2 className="w-16 h-16 text-primary mb-6 opacity-20" />
      <h3 className="text-xl font-black mb-2 tracking-tight">{t('assistant.no_findings')}</h3>
      <p className="text-muted-foreground max-w-sm text-center font-medium">
        {t('assistant.subtitle')}
      </p>
    </div>
  );
};
