import { CalendarClock, DoorOpen, Lightbulb, PlusCircle, Sparkles, Tag, Zap, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { getFindingDescription, getSafeFindingMetadata } from '../lib/assistantFindingPresentation';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
import { StatusPill } from './ui/StatusPill';

const TYPE_ICONS: Record<string, LucideIcon> = {
  habit_pattern_detected: CalendarClock,
  optimization_opportunity: Zap,
  optimization_suggestion: Zap,
  energy_waste_detected: Zap,
  device_missing_room: DoorOpen,
  new_device_available: PlusCircle,
  device_name_technical: Tag,
  device_name_duplicate: Tag,
  scene_suggestion: Lightbulb,
  automation_suggestion: Sparkles,
};

interface HomeSuggestionRowProps {
  finding: AssistantFinding;
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

/** One suggestion on Home: what kind it is at a glance, what it is about, and one clear way to act on it. */
export function HomeSuggestionRow({ finding, onAction }: HomeSuggestionRowProps) {
  const { t } = useTranslation();
  const metadata = getSafeFindingMetadata(finding.metadata);
  const kind = t(`assistant.types.${finding.type}`);
  const context = [metadata.friendlyName, metadata.deviceName, metadata.name, metadata.roomName]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0) || kind;
  const Icon = TYPE_ICONS[finding.type] ?? Sparkles;
  const urgent = finding.severity === 'high';
  const [first, ...rest] = finding.actions.filter(action => action.type !== 'ignore');
  const ignore = finding.actions.find(action => action.type === 'ignore');
  return (
    <Card as="article" variant="flat" aria-label={context} className="homepilot-home-suggestion flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4">
      <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-control', urgent ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary')}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-52">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{kind}</span>
          {urgent && <StatusPill variant="warning" size="sm">{t('assistant.severities.high')}</StatusPill>}
        </div>
        <Heading variant="item" className="mt-0.5 break-words">{context}</Heading>
        <p className="mt-0.5 max-w-prose break-words text-caption leading-normal text-muted-foreground">{getFindingDescription(finding, (key, values) => t(key, values))}</p>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        {[first, ...rest].filter((action): action is AssistantFindingAction => Boolean(action)).map((action, index) => (
          <Button key={`${action.type}-${index}`} size="sm" variant={index === 0 ? 'outline' : 'secondary'} className={cn('whitespace-normal', index === 0 && 'border-primary/50 text-primary hover:bg-primary/10')} onClick={() => onAction(finding, action)}>{t(action.label)}</Button>
        ))}
        {ignore && <Button size="sm" variant="ghost" className="whitespace-normal text-muted-foreground" onClick={() => onAction(finding, ignore)}>{t(ignore.label)}</Button>}
      </div>
    </Card>
  );
}
