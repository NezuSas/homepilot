import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Info, Sparkles, Zap } from 'lucide-react';
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
    <article aria-label={context || t(`assistant.types.${finding.type}`)} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4">
      {React.createElement(icon, { 'aria-hidden': true, className: 'size-5 shrink-0 text-primary' })}
      <div className="min-w-0 flex-1 basis-48">
        <h3 className="break-words text-body-compact font-semibold text-foreground">{context || t(`assistant.types.${finding.type}`)}</h3>
        <p className="mt-1 max-w-prose break-words text-caption leading-normal text-muted-foreground">{getFindingDescription(finding, (key, values) => t(key, values))}</p>
        {metadata.ready === true && <span className="text-caption text-success">{t('assistant.draft.ready')}</span>}
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        {finding.actions.map((action, index) => (
          <Button key={`${action.type}-${index}`} size="sm" variant={index === 0 ? 'primary' : 'secondary'}
            className="min-h-11 whitespace-normal text-caption"
            onClick={(event) => {
              if (action.type === 'ignore' && onDismiss) onDismiss(finding.id, event);
              else onAction(finding, action);
            }}>{t(action.label)}</Button>
        ))}
        {onDismiss && !finding.actions.some(action => action.type === 'ignore') && (
          <IconButton size="lg" icon={CheckCircle2} label={t('assistant.actions.ignore')} variant="ghost"
            onClick={event => onDismiss(finding.id, event)} />
        )}
      </div>
    </article>
  );
}
