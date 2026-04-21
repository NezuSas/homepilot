import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';
import { Zap, Activity, Battery, AlertCircle, RefreshCw } from 'lucide-react';
import { useEnergyStore } from '../../../stores/useEnergyStore';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

interface EnergySnapshotWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onConfigure?: () => void;
}

export function EnergySnapshotWidget({ config, isEditing, onConfigure }: EnergySnapshotWidgetProps) {
  const { t } = useTranslation();
  const { entities, isLoading, refreshEnergy, computeTotalPower, computeTotalEnergy } = useEnergyStore();

  useEffect(() => {
    refreshEnergy();
    const interval = setInterval(refreshEnergy, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [refreshEnergy]);

  const power = computeTotalPower();
  const energy = computeTotalEnergy();
  const hasData = entities.length > 0;

  if (!hasData && !isLoading) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.energy_insight.label')}
        icon={Zap}
        message={t('dashboards.widgets.energy_insight.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
    );
  }

  return (
    <div className={cn(
      "relative w-full h-full rounded-[2.5rem] overflow-hidden p-6 transition-all duration-700",
      config.appearance.variant === 'glass' && "bg-card/40 backdrop-blur-2xl border border-border/40",
      config.appearance.variant === 'solid' && "bg-background border border-border/20",
      config.appearance.variant === 'outline' && "border-2 border-primary/20",
      config.appearance.variant === 'flat' && "bg-muted/30"
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 animate-pulse" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Zap className="w-5 h-5 fill-primary/20" />
          </div>
          <div>
            {config.appearance.showTitle && (
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">
                {config.appearance.title || t('dashboards.widgets.energy_insight.label')}
              </h3>
            )}
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">
              <Activity className="w-3 h-3" />
              {t('shell.status.live')}
            </div>
          </div>
        </div>
        {isLoading && <RefreshCw className="w-3.5 h-3.5 text-primary/40 animate-spin" />}
      </div>

      <div className="grid grid-cols-1 gap-6 relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{t('dashboards.widgets.energy_insight.current_power')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter text-foreground tabular-nums">
              {power.toLocaleString()}
            </span>
            <span className="text-sm font-black text-primary uppercase tracking-widest">W</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-3xl bg-muted/20 border border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-muted-foreground">
               <Battery className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">{t('dashboards.widgets.energy_insight.consumption_today')}</span>
               <span className="text-sm font-black text-foreground tabular-nums">{energy.toFixed(1)} kWh</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-1 text-[9px] font-black text-green-500 uppercase tracking-widest">
                <AlertCircle className="w-2.5 h-2.5 rotate-180" />
                {t('dashboards.widgets.energy_insight.sustainable')}
             </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2 relative z-10">
         {entities.slice(0, 2).map(entity => (
           <div key={entity.entity_id} className="flex items-center justify-between px-2">
              <span className="text-[9px] font-bold text-muted-foreground/60 truncate max-w-[120px] uppercase tracking-widest">{entity.name}</span>
              <span className="text-[9px] font-black text-foreground/80 tabular-nums">{entity.state} {entity.unit}</span>
           </div>
         ))}
      </div>
    </div>
  );
}
