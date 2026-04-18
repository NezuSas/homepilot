import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Cpu, TrendingDown, AlertTriangle, Leaf, ChevronRight } from 'lucide-react';
import type { View } from '../types';

interface EnergyViewProps {
  onNavigate?: (view: View) => void;
}

export const EnergyView: React.FC<EnergyViewProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const features: { icon: React.FC<{ className?: string }>; key: string }[] = [
    { icon: Zap,           key: 'feature_consumption' },
    { icon: AlertTriangle, key: 'feature_idle' },
    { icon: TrendingDown,  key: 'feature_savings' },
    { icon: Leaf,          key: 'feature_offline' },
  ];

  return (
    <div className="flex flex-col gap-0 animate-in fade-in duration-700 min-h-full">

      {/* ── Identity Banner ──────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden mb-8 border border-border/60 bg-gradient-to-br from-card via-card to-amber-500/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-amber-500/3 rounded-full blur-2xl translate-y-1/2" />
        </div>
        <div className="relative z-10 p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-500/50 flex items-center justify-center shadow-xl shadow-amber-500/25 shrink-0">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500/80 mb-1">{t('energy.category')}</p>
              <h2 className="text-2xl font-black text-foreground tracking-tight">{t('energy.title')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('energy.subtitle')}</p>
            </div>
          </div>
          {/* Local badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
            <Cpu className="w-3 h-3 text-amber-500/70" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">{t('energy.status_active')}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

        {/* Left: Empty State / Coming Soon */}
        <div className="flex flex-col gap-6">
          {/* Hero empty state */}
          <div className="relative rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-amber-500/5 overflow-hidden p-10 flex flex-col items-center text-center gap-6 select-none">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04)_0%,transparent_70%)]" />
            </div>

            <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10">
              <Zap className="w-11 h-11 text-amber-500/50" />
              <div className="absolute inset-0 rounded-[2rem] border border-amber-500/10 scale-125 opacity-40" />
            </div>

            <div className="space-y-3 max-w-md z-10">
              <h3 className="text-xl font-black text-foreground tracking-tight">{t('energy.empty_title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('energy.empty_description')}</p>
            </div>

            {/* Feature list */}
            <div className="w-full max-w-sm space-y-2 z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">{t('energy.what_you_will_see')}</p>
              {features.map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-muted/30 border border-border/40 text-left">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-amber-500/70" />
                  </div>
                  <span className="text-xs font-bold text-foreground/70">{t(`energy.${key}`)}</span>
                </div>
              ))}
            </div>

            {/* Local badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/5 border border-amber-500/15 z-10">
              <Leaf className="w-3 h-3 text-amber-500/60" />
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">{t('energy.powered_by_local')}</span>
            </div>
          </div>
        </div>

        {/* Right: Bridge to Assistant */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary/70" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground">{t('nav.assistant')}</p>
                <p className="text-[10px] text-muted-foreground/60">{t('assistant.subtitle')}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('energy.insight_hint')}</p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('assistant')}
                className="flex items-center justify-between gap-2 w-full px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group active:scale-[0.98]"
              >
                <span className="text-xs font-black uppercase tracking-widest text-primary/80 group-hover:text-primary">
                  {t('energy.go_to_assistant')}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-primary/50 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          {/* Placeholder metric cards — pure skeleton shapes, no hardcoded strings */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-card/60 p-5 flex items-center gap-4 opacity-25 select-none pointer-events-none">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-muted-foreground/30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-2.5 bg-muted rounded-full mb-2" style={{ width: `${60 + i * 12}px` }} />
                <div className="h-2 bg-muted/60 rounded-full" style={{ width: `${36 + i * 8}px` }} />
              </div>
              <div className="text-right shrink-0">
                <div className="h-3 w-12 bg-muted rounded-full mb-1.5 ml-auto" />
                <div className="h-2 w-8 bg-muted/50 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
