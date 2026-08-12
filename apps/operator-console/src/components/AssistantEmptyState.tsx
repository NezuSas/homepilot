import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

export const AssistantEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-xl items-center gap-3 rounded-card border border-success/20 bg-success/5 px-4 py-3 text-caption text-muted-foreground">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      <p>{t('assistant.no_findings')}</p>
    </div>
  );
};