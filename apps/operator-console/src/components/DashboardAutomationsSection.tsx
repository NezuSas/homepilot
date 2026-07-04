import React from 'react';
import { Clock3, Plus, Settings2, Star, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

export interface DashboardAutomation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { type: 'device_state_changed' | 'time'; time?: string; timeLocal?: string };
}

interface DashboardAutomationsSectionProps {
  automations: DashboardAutomation[];
  favoriteAutomationIds: string[];
  processingId: string | null;
  onToggle: (automation: DashboardAutomation) => void;
  onCreate: () => void;
  onManage: () => void;
}

export const DashboardAutomationsSection: React.FC<DashboardAutomationsSectionProps> = ({
  automations,
  favoriteAutomationIds,
  processingId,
  onToggle,
  onCreate,
  onManage,
}) => {
  const { t } = useTranslation();
  const favorites = automations.filter((automation) => favoriteAutomationIds.includes(automation.id));

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" data-demo="dashboard-automations">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold tracking-tight text-foreground">{t('dashboard.favorite_automations')}</h2>
        <Button variant="ghost" onClick={onManage} className="h-auto gap-2 px-0 text-caption font-semibold text-primary">
          <Settings2 className="h-3.5 w-3.5" />
          {t('dashboard.manage_automations')}
        </Button>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border/60 bg-card/35 px-6 py-9 text-center">
          <Star className="mb-3 h-8 w-8 text-primary/40" />
          <p className="text-body font-semibold text-foreground">{t('dashboard.no_favorite_automations')}</p>
          <p className="mt-1 max-w-md text-caption text-muted-foreground">{t('dashboard.no_favorite_automations_hint')}</p>
          <Button variant="ghost" size="sm" onClick={automations.length === 0 ? onCreate : onManage} className="mt-3 gap-2 text-caption font-semibold text-primary">
            {automations.length === 0 && <Plus className="h-3.5 w-3.5" />}
            {automations.length === 0 ? t('dashboard.new_automation') : t('dashboard.manage_automations')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((automation) => {
            const isProcessing = processingId === automation.id;
            const TriggerIcon = automation.trigger.type === 'time' ? Clock3 : Zap;
            return (
              <button
                key={automation.id}
                type="button"
                onClick={() => onToggle(automation)}
                disabled={processingId !== null}
                className={cn(
                  'flex min-h-24 items-center gap-4 rounded-card border bg-card p-4 text-left shadow-depth-1 surface-transition interactive-lift disabled:opacity-60',
                  automation.enabled ? 'border-primary/30' : 'border-border/65',
                )}
              >
                <span className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border',
                  automation.enabled ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground',
                )}>
                  <TriggerIcon className={cn('h-5 w-5', isProcessing && 'animate-pulse')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-card-title font-semibold text-foreground">{automation.name}</span>
                  <span className={cn('mt-1 block text-caption', automation.enabled ? 'text-primary' : 'text-muted-foreground')}>
                    {automation.enabled ? t('automations.summary.active') : t('automations.summary.paused')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
