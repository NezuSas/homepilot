import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus } from 'lucide-react';
import { Button } from './ui/Button';

interface EmptyDashboardsProps {
  onCreate: () => void;
}

export const EmptyDashboards: React.FC<EmptyDashboardsProps> = ({ onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] gap-8 text-center select-none animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
          <LayoutDashboard className="w-12 h-12 text-primary/50" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/40">
          <Plus className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="absolute inset-0 rounded-[2.5rem] bg-primary/5 blur-2xl -z-10 scale-150" />
      </div>
      <div className="space-y-3 max-w-sm">
        <h3 className="text-2xl font-black text-foreground tracking-tight">{t('dashboards.empty_title')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('dashboards.empty_description')}</p>
      </div>
      <Button variant="primary" onClick={onCreate} className="flex items-center gap-2 px-8 py-3 text-sm">
        <Plus className="w-4 h-4" />
        {t('dashboards.action_create')}
      </Button>
    </div>
  );
};
