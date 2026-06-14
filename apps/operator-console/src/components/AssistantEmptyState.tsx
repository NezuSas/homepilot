import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

export const AssistantEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={CheckCircle2}
      title={t('assistant.no_findings')}
      description={t('assistant.subtitle')}
      className="py-24"
    />
  );
};
