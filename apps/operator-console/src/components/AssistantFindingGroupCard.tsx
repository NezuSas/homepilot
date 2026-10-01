import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { AssistantFindingCard } from './AssistantFindingCard';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface AssistantFindingGroup {
  id: string;
  type: string;
  subGroups: { name: string; findings: AssistantFinding[] }[];
  actions: AssistantFindingAction[];
}
interface Props {
  group: AssistantFindingGroup;
  isExpanded: boolean;
  onToggleGroup: (id: string) => void;
  onImportAll: () => void;
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
  onDismiss: (id: string, event: React.MouseEvent) => void;
}

export function AssistantFindingGroupCard({ group, isExpanded, onToggleGroup, onImportAll, onAction, onDismiss }: Props) {
  const { t } = useTranslation();
  const contentId = useId();
  const findings = group.subGroups.flatMap(subGroup => subGroup.findings);
  return <section className="min-w-0">
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-1">
      <Button variant="ghost" type="button" aria-expanded={isExpanded} aria-controls={contentId}
        onClick={() => onToggleGroup(group.id)}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-start gap-3 rounded-control px-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ChevronDown aria-hidden className={`size-4 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
        <span className="min-w-0 break-words text-body font-semibold">{t(`assistant.types.${group.type}`)}</span>
        <span className="ml-auto shrink-0 text-caption tabular-nums text-muted-foreground">{findings.length}</span>
      </Button>
      {group.actions.filter(action => action.type === 'import_all').map(action => (
        <Button key={action.type} size="sm" onClick={onImportAll}>{t(action.label)}</Button>
      ))}
    </div>
    <div id={contentId} hidden={!isExpanded}>
      {isExpanded && <div className="divide-y divide-border/60">
        {findings.map(finding => <AssistantFindingCard key={finding.id} finding={finding} onAction={onAction} onDismiss={onDismiss} />)}
      </div>}
    </div>
  </section>;
}
