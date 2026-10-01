import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Info, Sparkles, Zap } from 'lucide-react';
import { AssistantCard } from './ui/AssistantCard';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { getFindingDescription, getSafeFindingMetadata } from '../lib/assistantFindingPresentation';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface AssistantFindingCardProps {
  finding: AssistantFinding;
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
  onDismiss?: (id: string, event: React.MouseEvent) => void;
}

export function AssistantFindingCard({ finding, onAction, onDismiss }: AssistantFindingCardProps) {
  const { t } = useTranslation();
  const metadata = getSafeFindingMetadata(finding.metadata);
  const context = [metadata.friendlyName, metadata.deviceName, metadata.name, metadata.roomName]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0) || '';
  const icon = /energy|consumption|optimization|long_running/.test(finding.type) ? Zap
    : /suggestion|habit|opportunity/.test(finding.type) ? Sparkles : Info;
  return (
    <AssistantCard icon={icon} category={t(`assistant.types.${finding.type}`)}
      title={context || t(`assistant.types.${finding.type}`)}
      description={getFindingDescription(finding, (key, values) => t(key, values))}
      severity={finding.severity}
      actions={<>
        {finding.actions.map((action, index) => (
          <Button key={`${action.type}-${index}`} size="sm" variant={index === 0 ? 'primary' : 'secondary'}
            className="min-h-11 flex-1 whitespace-normal text-caption"
            onClick={(event) => {
              if (action.type === 'ignore' && onDismiss) onDismiss(finding.id, event);
              else onAction(finding, action);
            }}>{t(action.label)}</Button>
        ))}
        {onDismiss && !finding.actions.some(action => action.type === 'ignore') && (
          <IconButton size="lg" icon={CheckCircle2} label={t('assistant.actions.ignore')} variant="ghost"
            onClick={event => onDismiss(finding.id, event)} />
        )}
      </>}>
      {metadata.ready === true && <span className="text-caption text-success">{t('assistant.draft.ready')}</span>}
    </AssistantCard>
  );
}
