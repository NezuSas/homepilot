import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Cpu, TrendingDown, AlertTriangle, Leaf, ChevronRight, Activity } from 'lucide-react';
import type { View } from '../types';
import { useEnergyStore } from '../stores/useEnergyStore';
import { Card } from '../components/ui/Card';

interface EnergyViewProps {
  onNavigate?: (view: View) => void;
}

export const EnergyView: React.FC<EnergyViewProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { entities, isLoading, refreshEnergy, computeTotalPower, computeTotalEnergy } = useEnergyStore();

  useEffect(() => {
    refreshEnergy();
  }, [refreshEnergy]);

  const totalPower = computeTotalPower();
  const totalEnergy = computeTotalEnergy();
  const wEntities = (Array.isArray(entities) ? entities : []).filter(e => e.unit === 'W').sort((a, b) => b.state - a.state);

  const features: { icon: React.FC<{ className?: string }>; key: string }[] = [
    { icon: Zap,           key: 'feature_consumption' },
    { icon: AlertTriangle, key: 'feature_idle' },
    { icon: TrendingDown,  key: 'feature_savings' },
    { icon: Leaf,          key: 'feature_offline' },
  ];

  return (
    <div className="flex flex-col gap-0 animate-in fade-in duration-700 min-h-full">

      {/* ── Identity Banner ──────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden mb-8 border border-border/60 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 flex items-center justify-between gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Icon: muted card container with amber icon — consistent with widget accent pattern */}
            <div className="w-14 h-14 rounded-2xl bg-muted border border-border/80 flex items-center justify-center shadow-depth-1 shrink-0">
              <Zap className="w-7 h-7 text-warning/80" />
            </div>
            <div className="min-w-0">
              <p className="text-micro font-black uppercase tracking-[0.25em] text-warning/70 mb-1">{t('energy.category')}</p>
              <h2 className="text-panel-title sm:text-view-title font-black text-foreground tracking-tight">{t('energy.title')}</h2>
              <p className="text-caption text-muted-foreground mt-0.5">{t('energy.subtitle')}</p>
            </div>
          </div>
          {/* Status badge — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/20 shrink-0 shadow-sm">
            <Cpu className="w-3 h-3 text-primary/60" />
            <span className="text-micro font-black uppercase tracking-widest text-primary/80">{t('energy.status_active')}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse premium-glow-warning" />
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-8">

        {/* Left: Main Content / Data */}
        <div className="flex flex-col gap-6">
          {isLoading && entities.length === 0 ? (
            // Skeleton state
            <div className="flex flex-col gap-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-32 rounded-3xl bg-card border border-border/40" />
                <div className="h-32 rounded-3xl bg-card border border-border/40" />
              </div>
              <div className="h-64 rounded-3xl bg-card border border-border/40" />
            </div>
          ) : entities.length > 0 ? (
            // Live Data
            <div className="flex flex-col gap-8">
              {/* Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="relative flex flex-col justify-between p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-warning/80" />
                    </div>
                    <span className="text-body font-bold text-foreground/80">{t('energy.total_power')}</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-hero-title font-black text-foreground tracking-tight">
                        {totalPower >= 1000 ? (totalPower / 1000).toFixed(2) : Math.round(totalPower)}
                      </span>
                      <span className="text-body font-bold text-muted-foreground">
                        {totalPower >= 1000 ? 'kW' : 'W'}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="relative flex flex-col justify-between p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5 text-primary/80" />
                    </div>
                    <span className="text-body font-bold text-foreground/80">{t('energy.total_energy')}</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-hero-title font-black text-foreground tracking-tight">
                        {totalEnergy.toFixed(1)}
                      </span>
                      <span className="text-body font-bold text-muted-foreground">kWh</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Live Consumption List */}
              <div className="flex flex-col gap-3">
                <p className="text-micro font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1 mb-1">{t('energy.live_consumption')}</p>
                {wEntities.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-card border border-border/40 text-center text-body text-muted-foreground">
                    {t('energy.no_data')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.isArray(wEntities) && wEntities.map((e) => (
                      <Card key={e.entity_id} className="flex items-center justify-between gap-4 rounded-2xl p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-warning/60" />
                          </div>
                          <p className="text-body font-bold text-foreground truncate">{e.name}</p>
                        </div>
                        <div className="flex items-baseline gap-1 shrink-0 text-right">
                          <span className="text-body font-black text-warning/90">{Math.round(e.state)}</span>
                          <span className="text-micro font-black text-muted-foreground/60">W</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // No Data Fallback (Empty State)
            <div className="relative rounded-3xl border border-border/60 bg-card overflow-hidden p-6 sm:p-10 flex flex-col items-center text-center gap-5 sm:gap-6 select-none">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.03)_0%,transparent_70%)]" />
              </div>

              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-panel bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border/60 flex items-center justify-center shadow-depth-2">
                <Zap className="w-9 h-9 sm:w-11 sm:h-11 text-warning/50" />
                <div className="absolute inset-0 rounded-panel border border-border/30 scale-125 opacity-40" />
              </div>

              <div className="space-y-3 max-w-md z-10">
                <h3 className="text-section-title sm:text-panel-title font-black text-foreground tracking-tight">{t('energy.empty_title')}</h3>
                <p className="text-body text-muted-foreground leading-relaxed">{t('energy.empty_description')}</p>
              </div>

              {/* Feature list */}
              <div className="w-full max-w-sm space-y-2 z-10">
                <p className="text-micro font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">{t('energy.what_you_will_see')}</p>
                {features.map(({ icon: Icon, key }) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-muted/40 border border-border/40 text-left">
                    <div className="w-7 h-7 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-warning/70" />
                    </div>
                    <span className="text-caption font-bold text-foreground/70">{t(`energy.${key}`)}</span>
                  </div>
                ))}
              </div>

              {/* Local badge */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 border border-border/50 z-10">
                <Leaf className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">{t('energy.powered_by_local')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Bridge to Assistant */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary/70" />
              </div>
              <div className="min-w-0">
                <p className="text-caption font-black text-foreground">{t('nav.assistant')}</p>
                <p className="text-micro text-muted-foreground/60 truncate">{t('assistant.subtitle')}</p>
              </div>
            </div>
            <p className="text-caption text-muted-foreground leading-relaxed">{t('energy.insight_hint')}</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('assistant')}
                className="flex items-center justify-between gap-2 w-full px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group active:scale-[0.98]"
              >
                <span className="text-caption font-black uppercase tracking-widest text-primary/80 group-hover:text-primary">
                  {t('energy.go_to_assistant')}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-primary/50 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
