import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Pencil, Play, Star, Trash2, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { getDashboardIconComponent } from '../views/dashboards/components/IconPicker';

interface AutomationRule {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  trigger: { type: 'device_state_changed' | 'time'; deviceId?: string; expectedValue?: string; time?: string; timeLocal?: string };
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

export function AutomationRuleCard({ rule, processingId, getDeviceName, getSceneName, onToggle, onEdit, onDelete, isFavorite, onToggleFavorite, isExecuting, isExecutionBusy, isSuccessful, onExecute, canManage = true }: AutomationRuleCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const Icon = (rule.icon ? getDashboardIconComponent(rule.icon) : null) || (rule.trigger.type === 'time' ? Clock : Zap);

  return (
    <article aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3 rounded-section border border-border bg-card p-3 text-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="break-words text-body font-semibold">{rule.name}</h3>
        </div>
        <IconButton icon={Star} label={t(isFavorite ? 'automations.remove_favorite' : 'automations.add_favorite')} aria-pressed={isFavorite} onClick={() => onToggleFavorite(rule.id)} size="lg" variant="ghost" className={isFavorite ? 'text-primary [&_svg]:fill-current' : 'text-muted-foreground'} />
      </div>
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-caption leading-relaxed">
        <dt className="text-muted-foreground">{t('automations.summary.if')}</dt>
        <dd className="break-words">{rule.trigger.type === 'time' ? t('automations.summary.clock_hits', { time: rule.trigger.timeLocal || rule.trigger.time }) : t('automations.summary.when_device', { name: getDeviceName(rule.trigger.deviceId), value: rule.trigger.expectedValue })}</dd>
        <dt className="text-muted-foreground">{t('automations.summary.then')}</dt>
        <dd className="break-words">{rule.action.type === 'execute_scene' ? t('automations.summary.run_scene', { name: getSceneName(rule.action.sceneId) }) : t('automations.summary.run_command', { command: t(`automations.builder.commands.${rule.action.command}`, { defaultValue: rule.action.command || '' }), name: getDeviceName(rule.action.targetDeviceId) })}</dd>
      </dl>
      <Button type="button" variant="outline" size="md" disabled={!canManage} aria-pressed={rule.enabled} aria-label={t('automations.toggle_schedule', { name: rule.name })} isLoading={processingId === rule.id} onClick={() => onToggle(rule.id, rule.enabled)} className="min-h-11 w-full text-caption">
        {t(rule.enabled ? 'automations.summary.active' : 'automations.summary.paused')}
      </Button>
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button type="button" size="md" isLoading={isExecuting} disabled={isExecutionBusy} onClick={() => onExecute(rule.id)} className="min-h-11 min-w-0 flex-1 gap-2 text-body-compact">
          {isSuccessful ? <Check aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          <span role={isSuccessful ? 'status' : undefined} aria-live="polite">{t(isSuccessful ? 'automations.executed' : 'automations.execute_now')}</span>
        </Button>
        {canManage && <IconButton icon={Pencil} label={t('common.edit')} onClick={() => onEdit(rule)} size="lg" variant="default" />}
        {canManage && <IconButton icon={Trash2} label={t('common.delete')} onClick={() => onDelete(rule.id)} size="lg" variant="danger" />}
      </div>
    </article>
  );
}
