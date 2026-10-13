import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Loader2, Pencil, Play, Star, Trash2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
import { IconButton } from './ui/IconButton';
import { SurfaceButton } from './ui/SurfaceButton';
import { getDashboardIconComponent } from '../views/dashboards/components/IconPicker';

interface AutomationRule {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  trigger: { type: 'device_state_changed' | 'time'; deviceId?: string; expectedValue?: string; time?: string; timeLocal?: string; days?: number[] };
  action: { type: 'device_command' | 'execute_scene'; targetDeviceId?: string; command?: string; sceneId?: string };
}

interface AutomationRuleCardProps {
  canManage?: boolean;
  rule: AutomationRule;
  processingId: string | null;
  getDeviceName: (id?: string) => string;
  getSceneName: (id?: string) => string;
  onToggle: (id: string, currentlyEnabled: boolean) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isExecuting: boolean;
  isExecutionBusy: boolean;
  isSuccessful: boolean;
  onExecute: (id: string) => void;
}

/** Days a clock rule runs, as people say them: every day, weekdays, or the names of the days. */
function describeDays(days: number[] | undefined, language: string | undefined, t: (key: string) => string): string {
  const selected = [...new Set(days ?? [0, 1, 2, 3, 4, 5, 6])].sort((a, b) => a - b);
  if (selected.length === 7) return t('automations.summary.every_day');
  if (selected.join() === '1,2,3,4,5') return t('automations.summary.weekdays');
  const name = new Intl.DateTimeFormat(language, { weekday: 'short' });
  return new Intl.ListFormat(language, { style: 'short', type: 'conjunction' }).format(selected.map(day => name.format(new Date(2024, 0, 7 + day))));
}

export function AutomationRuleCard({ rule, processingId, getDeviceName, getSceneName, onToggle, onEdit, onDelete, isFavorite, onToggleFavorite, isExecuting, isExecutionBusy, isSuccessful, onExecute, canManage = true }: AutomationRuleCardProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const Icon = (rule.icon ? getDashboardIconComponent(rule.icon) : null) || (rule.trigger.type === 'time' ? Clock : Zap);

  return (
    <Card variant="flat" radius="section" as="article" aria-labelledby={titleId} className="flex flex-col gap-3 p-3 text-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <Heading id={titleId} variant="item">{rule.name}</Heading>
        </div>
        <IconButton icon={Star} label={t(isFavorite ? 'automations.remove_favorite' : 'automations.add_favorite')} aria-pressed={isFavorite} onClick={() => onToggleFavorite(rule.id)} size="lg" variant="ghost" className={isFavorite ? 'text-primary [&_svg]:fill-current' : 'text-muted-foreground'} />
      </div>
      <dl className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-caption leading-relaxed">
        <dt className="text-muted-foreground">{t('automations.summary.if')}</dt>
        <dd className="break-words">{rule.trigger.type === 'time' ? `${t('automations.summary.clock_hits', { time: rule.trigger.timeLocal || rule.trigger.time })} · ${describeDays(rule.trigger.days, i18n?.language, t)}` : t('automations.summary.when_device', { name: getDeviceName(rule.trigger.deviceId), value: rule.trigger.expectedValue === 'on' || rule.trigger.expectedValue === 'off' ? t(`automations.summary.state_${rule.trigger.expectedValue}`) : rule.trigger.expectedValue })}</dd>
        <dt className="text-muted-foreground">{t('automations.summary.then')}</dt>
        <dd className="break-words">{rule.action.type === 'execute_scene' ? t('automations.summary.run_scene', { name: getSceneName(rule.action.sceneId) }) : t('automations.summary.run_command', { command: t(`automations.builder.commands.${rule.action.command}`, { defaultValue: rule.action.command || '' }), name: getDeviceName(rule.action.targetDeviceId) })}</dd>
      </dl>
      <SurfaceButton type="button" disabled={!canManage || processingId === rule.id} aria-pressed={rule.enabled} aria-label={t('automations.toggle_schedule', { name: rule.name })} onClick={() => onToggle(rule.id, rule.enabled)}
        className="flex min-h-11 w-full justify-between gap-3 rounded-control px-1 text-left text-caption">
        <span className={rule.enabled ? 'text-foreground' : 'text-muted-foreground'}>{t(rule.enabled ? 'automations.summary.active' : 'automations.summary.paused')}</span>
        <span aria-hidden="true" className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', rule.enabled ? 'border-primary/40 bg-primary/25' : 'border-border bg-muted/60')}>
          <span className={cn('absolute top-0.5 grid size-5 place-items-center rounded-full shadow-sm transition-all', rule.enabled ? 'right-0.5 bg-primary' : 'left-0.5 bg-background')}>
            {processingId === rule.id && <Loader2 className="size-3 animate-spin text-muted-foreground motion-reduce:animate-none" />}
          </span>
        </span>
      </SurfaceButton>
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button type="button" size="md" variant="outline" isLoading={isExecuting} disabled={isExecutionBusy} onClick={() => onExecute(rule.id)} className="min-w-0 flex-1 border-primary/50 text-primary hover:bg-primary/10">
          {isSuccessful ? <Check aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          <span role={isSuccessful ? 'status' : undefined} aria-live="polite">{t(isSuccessful ? 'automations.executed' : 'automations.execute_now')}</span>
        </Button>
        {canManage && <IconButton icon={Pencil} label={t('common.edit')} onClick={() => onEdit(rule)} size="lg" variant="ghost" />}
        {canManage && <IconButton icon={Trash2} label={t('common.delete')} onClick={() => onDelete(rule.id)} size="lg" variant="ghost" className="hover:text-danger" />}
      </div>
    </Card>
  );
}
