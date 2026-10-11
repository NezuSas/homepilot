import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';

interface EmptyDashboardsProps {
  onRetry: () => void;
}

export const EmptyDashboards: React.FC<EmptyDashboardsProps> = ({ onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-empty-lg gap-8 text-center select-none animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-28 h-28 rounded-dashboard bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
          <LayoutDashboard className="w-12 h-12 text-primary/50" />
        </div>
        <div className="absolute inset-0 rounded-dashboard bg-primary/5 blur-2xl -z-10 scale-150" />
      </div>
      <div className="space-y-3 max-w-sm">
        <Heading as="h3" variant="view">{t('dashboards.error_load')}</Heading>
        <p className="text-body text-muted-foreground leading-relaxed">{t('dashboards.own_dashboard_retry_hint')}</p>
      </div>
      <Button variant="primary" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
};
