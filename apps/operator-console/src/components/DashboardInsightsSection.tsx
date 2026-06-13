import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Zap } from 'lucide-react';
import { AssistantCard } from './ui/AssistantCard';
import { Button } from './ui/Button';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface DashboardInsightsSectionProps {
  findings: AssistantFinding[];
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

const getMetadataText = (
  metadata: Record<string, unknown>,
  keys: string[],
  fallback: string
): string => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
};

const isEnergyFinding = (finding: AssistantFinding): boolean => {
  return finding.type.includes('energy')
    || finding.type.includes('consumption')
    || finding.type.includes('long_running');
};

export const DashboardInsightsSection: React.FC<DashboardInsightsSectionProps> = ({
  findings,
  onAction,
}) => {
  const { t } = useTranslation();

  if (findings.length === 0) {
    return null;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex items-center gap-3 px-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          {t('dashboard.actionable_insights')}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-muted to-transparent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {findings.slice(0, 2).map((finding) => {
          const isEnergy = isEnergyFinding(finding);

          return (
            <AssistantCard
              key={finding.id}
              icon={isEnergy ? Zap : Sparkles}
              category={isEnergy ? t('dashboard.energy_insight') : t('dashboard.proactive')}
              title={getMetadataText(finding.metadata, ['displayTitle'], t(`assistant.types.${finding.type}`))}
              description={getMetadataText(
                finding.metadata,
                ['displayDescription'],
                t(`assistant.types.${finding.type}_description`, finding.metadata) as string
              )}
              severity={finding.severity}
              actions={
                <div className="flex gap-2 w-full mt-2">
                  {finding.actions.map((action, index) => (
                    <Button
                      key={`${finding.id}-${action.type}-${index}`}
                      size="sm"
                      variant={index === 0 ? 'primary' : 'secondary'}
                      onClick={() => onAction(finding, action)}
                      className="flex-1 text-[10px] uppercase tracking-widest h-auto py-3"
                    >
                      {t(action.label)}
                    </Button>
                  ))}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
};
