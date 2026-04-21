import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAssistantStore } from '../../../stores/useAssistantStore';
import { Button } from '../../../components/ui/Button';

export function AssistantInsightWidget({ config }: { config: DashboardWidgetConfig }) {
  const { t } = useTranslation();
  const { findings, isLoading } = useAssistantStore();
  
  // Get top finding (sorted by score if available, or just the first)
  const topFinding = findings.filter(f => f.status === 'open').sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-destructive border-destructive/20 bg-destructive/5';
      case 'medium': return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
      case 'low': return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
      default: return 'text-muted-foreground border-border bg-muted/5';
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full rounded-3xl p-5 transition-all duration-500",
      config.appearance.variant === 'glass' ? "bg-card/40 backdrop-blur-md border border-border/40" : "bg-card border border-border"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-foreground tracking-tight">
            {config.appearance.title || t('dashboards.widgets.assistant_insights.label')}
          </h3>
        </div>
        {isLoading && (
          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center items-center text-center py-2">
        {!topFinding ? (
          <div className="space-y-3 animate-in fade-in duration-700">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground mb-1">{t('dashboards.widgets.assistant_insights.no_findings')}</p>
              <p className="text-[10px] text-muted-foreground max-w-[140px] mx-auto leading-relaxed">{t('dashboards.widgets.assistant_insights.no_findings_desc')}</p>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4 animate-in slide-in-from-bottom-2 duration-500">
            <div className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", getSeverityStyles(topFinding.severity))}>
              <AlertCircle className="w-3 h-3" />
              {t(`assistant.severities.${topFinding.severity}`)}
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-black text-foreground leading-tight tracking-tight px-2 line-clamp-1">{topFinding.title}</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 px-4 italic opacity-80">{topFinding.description}</p>
            </div>

            <div className="pt-2">
              <Button size="sm" variant="primary" className="w-full text-[9px] font-black uppercase tracking-widest gap-2 bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/20 transition-all duration-300">
                {t('dashboards.widgets.assistant_insights.view_details')} <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
