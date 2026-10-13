import { useId, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { getFindingDescription } from '../lib/assistantFindingPresentation';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
import { StatusPill } from './ui/StatusPill';
import { SurfaceButton } from './ui/SurfaceButton';
import { findingContext, SuggestionActions, TYPE_ICONS } from './HomeSuggestionRow';

const NAMES_SHOWN = 3;

interface HomeSuggestionGroupProps {
  findings: AssistantFinding[];
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

/** Several suggestions of the same kind as one card: it names the devices and opens to the individual actions. */
export function HomeSuggestionGroup({ findings, onAction }: HomeSuggestionGroupProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const type = findings[0]!.type;
  const kind = t(`assistant.types.${type}`);
  const Icon = TYPE_ICONS[type] ?? Sparkles;
  const urgent = findings.some(finding => finding.severity === 'high');
  const names = findings.map(finding => findingContext(finding, kind));
  const shown = names.slice(0, NAMES_SHOWN);
  const rest = names.length - shown.length;
  const summary = new Intl.ListFormat(i18n?.language, { style: 'long', type: 'conjunction' })
    .format(rest > 0 ? [...shown, t('dashboard.insights_more', { count: rest })] : shown);
  return (
    <Card as="article" variant="flat" aria-label={kind} className="homepilot-home-suggestion-group">
      <SurfaceButton type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}
        className="flex min-h-16 w-full items-center justify-start gap-4 p-3 text-left sm:px-4 focus-visible:ring-inset">
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-control', urgent ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary')}>
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Heading as="span" variant="item" className="break-words">{kind}</Heading>
            <StatusPill variant={urgent ? 'warning' : 'neutral'} size="sm">{t('dashboard.insights_group_count', { count: findings.length })}</StatusPill>
          </span>
          <span className="mt-0.5 block break-words text-caption font-normal leading-normal text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </SurfaceButton>
      <ul id={listId} hidden={!open} className="divide-y divide-border/60 border-t border-border/60">
        {open && findings.map(finding => (
          <li key={finding.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 pl-[4.25rem] pr-3 sm:pr-4">
            <div className="min-w-0 flex-1 basis-44">
              <p className="break-words text-body-compact font-semibold text-foreground">{findingContext(finding, kind)}</p>
              <p className="break-words text-caption text-muted-foreground">{getFindingDescription(finding, (key, values) => t(key, values))}</p>
            </div>
            <SuggestionActions finding={finding} onAction={onAction} quiet />
          </li>
        ))}
      </ul>
    </Card>
  );
}
