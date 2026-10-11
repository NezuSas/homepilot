import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { useAssistantStore } from '../../../stores/useAssistantStore';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Heading } from '../../../components/ui/Heading';
import { StatusPill } from '../../../components/ui/StatusPill';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import { isFindingOperational } from '../../../lib/deviceOperationalEligibility';

export function AssistantInsightWidget({ config }: { config: DashboardWidgetConfig }) {
  const { t } = useTranslation();
  const { findings, isLoading } = useAssistantStore();
  const devices = useDeviceSnapshotStore(state => state.devices);
  const roomsByHome = useDeviceSnapshotStore(state => state.roomsByHome);
  
  // Get top finding (sorted by score if available, or just the first)
  const topFinding = findings.filter(f => f.status === 'open' && isFindingOperational(f, devices, Object.values(roomsByHome).flat()))
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'primary';
      default: return 'neutral';
    }
  };

  return (
    <Card
      variant={config.appearance.variant === 'glass' ? 'glass' : 'flat'}
      className="flex flex-col h-full min-h-0 p-4 @md:p-5 transition-all duration-500"
    >
      <div className="flex items-center justify-between gap-2 mb-3 @md:mb-4">
        <div className="flex items-center gap-2">
          <StatusPill variant="primary" className="p-2">
            <Sparkles className="w-4 h-4" />
          </StatusPill>
          <Heading as="h3" variant="card" className="truncate">
            {config.appearance.title || t('dashboards.widgets.assistant_insights.label')}
          </Heading>
        </div>
        {isLoading && (
          <Loader2 aria-hidden="true" className="w-3 h-3 text-primary animate-spin" />
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center items-center text-center py-2">
        {!topFinding ? (
          <div className="space-y-3 animate-in fade-in duration-700">
            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto border border-success/20">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-caption font-black text-foreground mb-1">{t('dashboards.widgets.assistant_insights.no_findings')}</p>
              <p className="text-micro text-muted-foreground max-w-copy-sm mx-auto leading-relaxed">{t('dashboards.widgets.assistant_insights.no_findings_desc')}</p>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4 animate-in slide-in-from-bottom-2 duration-500">
            <StatusPill variant={getSeverityVariant(topFinding.severity)} uppercase>
              <AlertCircle className="w-3 h-3" />
              {t(`assistant.severities.${topFinding.severity}`)}
            </StatusPill>

            <div className="space-y-1">
              <Heading as="h4" variant="item" className="px-2 line-clamp-1">{topFinding.title}</Heading>
              <p className="text-micro text-muted-foreground leading-relaxed line-clamp-2 px-2 @md:px-4 italic opacity-80">{topFinding.description}</p>
            </div>

            <div className="pt-2">
              <Button size="sm" variant="primary" className="w-full transition-all duration-300">
                {t('dashboards.widgets.assistant_insights.view_details')} <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
