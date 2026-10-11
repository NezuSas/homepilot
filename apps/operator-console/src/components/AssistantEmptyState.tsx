import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from './ui/AlertBanner';

export const AssistantEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return <AlertBanner variant="success" size="sm" className="mx-auto max-w-xl" message={t('assistant.no_findings')} />;
};
