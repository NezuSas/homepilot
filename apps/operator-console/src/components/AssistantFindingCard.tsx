import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Copy,
  Hash,
  Info,
  PlusCircle,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { StatusPill } from './ui/StatusPill';
import {
  getSafeFindingMetadata,
  hasTechnicalFindingMetadata,
} from '../lib/assistantFindingPresentation';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface AssistantFindingCardProps {
  finding: AssistantFinding;
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
  onDismiss: (id: string, event: React.MouseEvent) => void;
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

const isProactiveType = (type: string): boolean => {
  return [
    'habit_pattern_detected',
    'proactive_automation_opportunity',
    'automation_suggestion',
    'scene_suggestion',
    'energy_waste_detected',
    'optimization_opportunity',
    'optimization_suggestion',
  ].includes(type);
};

const getIcon = (type: string) => {
  switch (type) {
    case 'new_device_available':             return <PlusCircle className="w-5 h-5 text-primary" />;
    case 'device_missing_room':              return <Hash className="w-5 h-5 text-warning" />;
    case 'device_name_technical':            return <Type className="w-5 h-5 text-primary" />;
    case 'device_name_duplicate':            return <Copy className="w-5 h-5 text-danger" />;
    case 'automation_suggestion':            return <Sparkles className="w-5 h-5 text-primary" />;
    case 'scene_suggestion':                 return <Sparkles className="w-5 h-5 text-primary" />;
    case 'optimization_suggestion':          return <Zap className="w-5 h-5 text-success" />;
    case 'energy_waste_detected':            return <Zap className="w-5 h-5 text-warning" />;
    case 'habit_pattern_detected':           return <Sparkles className="w-5 h-5 text-primary" />;
    case 'proactive_automation_opportunity': return <Sparkles className="w-5 h-5 text-primary" />;
    case 'optimization_opportunity':         return <Info className="w-5 h-5 text-muted-foreground" />;
    default:                                 return <Info className="w-5 h-5 text-primary" />;
  }
};

export const AssistantFindingCard: React.FC<AssistantFindingCardProps> = ({
  finding,
  onAction,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const reasonKey = getMetadataText(finding.metadata, ['reasonKey'], '');
  const safeMetadata = getSafeFindingMetadata(finding.metadata);
  const description = hasTechnicalFindingMetadata(finding.metadata)
    ? t('assistant.generic_finding_description')
    : t(`assistant.types.${finding.type}_description`, safeMetadata);

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-panel border p-4 transition-all duration-300 sm:p-5',
        isProactiveType(finding.type)
          ? 'bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-xl shadow-primary/5 hover:shadow-primary/10 hover:-translate-y-1'
          : 'bg-card border-border hover:border-primary/30'
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="rounded-xl bg-muted/50 p-2.5 text-foreground transition-transform group-hover:scale-105">
          {getIcon(finding.type)}
        </div>
        <StatusPill
          variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'success'}
        >
          {t(`assistant.severities.${finding.severity}`)}
        </StatusPill>
      </div>

      <h3 className="mb-1.5 text-body-compact font-bold tracking-tight transition-colors group-hover:text-primary">
        {t(`assistant.types.${finding.type}`)}
      </h3>
      <p className="mb-4 text-caption leading-relaxed text-muted-foreground">
        {description}
      </p>

      {reasonKey !== '' && (
        <div className="mb-4 rounded-xl border border-primary/10 bg-primary/5 p-2.5 font-primary">
          <p className="flex items-center gap-2 text-micro font-semibold italic leading-normal text-primary">
            <Info className="w-3 h-3" />
            {t(`assistant.types.reasons.${reasonKey}`)}
          </p>
        </div>
      )}

      {finding.metadata.ready === true && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-2.5 py-2 text-success">
          <Sparkles className="w-3 h-3" />
          <span className="text-micro font-black uppercase tracking-wider">
            {t('assistant.draft.ready')}
          </span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        {finding.actions.map((action, index) => (
          <Button
            key={`${finding.id}-${action.type}-${index}`}
            variant={index === 0 ? 'primary' : 'secondary'}
            onClick={() => onAction(finding, action)}
            size="sm"
            className="flex-1 text-micro uppercase tracking-label"
          >
            {t(action.label)}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={(event) => onDismiss(finding.id, event)}
          size="sm"
          className="px-3 hover:bg-danger/10 hover:text-danger"
        >
          <CheckCircle2 className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
