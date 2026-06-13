import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Cpu, Loader2, Pencil, Trash2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'device_state_changed' | 'time';
    deviceId?: string;
    expectedValue?: unknown;
    time?: string;
    timeLocal?: string;
  };
  action: {
    type: 'device_command' | 'execute_scene';
    targetDeviceId?: string;
    command?: string;
    sceneId?: string;
  };
}

interface Device {
  id: string;
  integrationSource?: string;
}

interface Scene {
  id: string;
  actions?: { deviceId: string; command: string }[];
}

interface AutomationRuleCardProps {
  rule: AutomationRule;
  devices: Device[];
  scenes: Scene[];
  processingId: string | null;
  getDeviceName: (id?: string) => string;
  getSceneName: (id?: string) => string;
  onToggle: (id: string, currentlyEnabled: boolean) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (ruleId: string) => void;
}

export const AutomationRuleCard: React.FC<AutomationRuleCardProps> = ({
  rule,
  devices,
  scenes,
  processingId,
  getDeviceName,
  getSceneName,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isEnabled = rule.enabled;
  const isWorking = processingId === rule.id;
  const triggerDevice = devices.find((device) => device.id === rule.trigger.deviceId);
  const actionDevice = devices.find((device) => device.id === rule.action.targetDeviceId);
  const targetScene = scenes.find((scene) => scene.id === rule.action.sceneId);
  const isDeviceLocal = (device?: Device) => device?.integrationSource === 'sonoff';
  const triggerIsLocal = rule.trigger.type === 'time' || isDeviceLocal(triggerDevice);

  let isEdgeCapable = false;
  let actionIsLocal = false;

  if (rule.action.type === 'device_command') {
    actionIsLocal = isDeviceLocal(actionDevice);
  } else if (rule.action.type === 'execute_scene' && targetScene?.actions) {
    const sceneDevices = targetScene.actions.map((action) => devices.find((device) => device.id === action.deviceId));
    actionIsLocal = sceneDevices.every(isDeviceLocal);
    isEdgeCapable = sceneDevices.some(isDeviceLocal);
  }

  const isFullyAutonomous = triggerIsLocal && actionIsLocal;
  isEdgeCapable = isEdgeCapable || triggerIsLocal || actionIsLocal;
  const resilienceLabel = isFullyAutonomous ? 'Autonomous' : (isEdgeCapable ? 'Edge Capable' : 'Bridged');

  return (
    <div
      className={cn(
        'group relative overflow-hidden bg-card/40 backdrop-blur-xl rounded-[2.5rem] border transition-all duration-700',
        isEnabled
          ? 'border-primary/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] p-7'
          : 'border-border/10 opacity-60 p-7 grayscale hover:grayscale-0 hover:opacity-100'
      )}
    >
      {isEnabled && (
        <div className={cn(
          'absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000',
          isFullyAutonomous ? 'bg-success' : 'bg-primary'
        )} />
      )}

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 relative overflow-hidden',
            isEnabled
              ? (isFullyAutonomous ? 'bg-success text-success-foreground premium-glow-success shadow-lg shadow-success/20' : 'bg-primary text-primary-foreground premium-glow shadow-lg shadow-primary/20')
              : 'bg-muted text-muted-foreground'
          )}>
            {rule.trigger.type === 'time' ? <Clock className="w-6 h-6 relative z-10" /> : <Zap className="w-6 h-6 relative z-10" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-xl font-black tracking-tight leading-tight">{rule.name}</h4>
              {isEnabled && (
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0 bg-background/40 backdrop-blur-md',
                  isFullyAutonomous ? 'border-success/30 text-success'
                    : (isEdgeCapable ? 'border-primary/30 text-primary' : 'border-border/30 text-muted-foreground opacity-40')
                )}>
                  {isFullyAutonomous && <Cpu className="w-2.5 h-2.5" />}
                  <span className="text-[7.5px] font-black uppercase tracking-[0.1em]">{resilienceLabel}</span>
                </div>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
              {rule.trigger.type === 'time' ? t('automations.summary.schedule_based') : t('automations.summary.event_driven')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggle(rule.id, isEnabled)}
            disabled={isWorking}
            className={cn(
              'h-10 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm',
              isEnabled
                ? (isFullyAutonomous ? 'bg-success/10 text-success border border-success/10' : 'bg-primary/10 text-primary border border-primary/10')
                : 'bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary'
            )}
          >
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEnabled ? t('automations.summary.active') : t('automations.summary.paused'))}
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="w-10 h-10 flex items-center justify-center bg-muted/40 hover:bg-muted rounded-xl transition-all border border-transparent hover:border-border/20"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="w-10 h-10 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative p-6 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] flex flex-col gap-8">
        <div className="absolute left-[2.35rem] top-12 bottom-12 w-[1px] bg-gradient-to-b from-border/20 via-primary/20 to-border/20" />

        <div className="flex items-start gap-5 relative z-10">
          <div className={cn(
            'h-8 px-3 rounded-full flex items-center justify-center shrink-0 shadow-sm border transition-all duration-700',
            isEnabled ? 'bg-background border-border' : 'bg-muted/50 border-transparent'
          )}>
            <span className={cn('text-[9px] font-black tracking-tighter', isEnabled ? 'opacity-40' : 'opacity-20')}>{t('automations.summary.if')}</span>
          </div>
          <div className="pt-0.5">
            <p className={cn(
              'text-lg font-black tracking-tight leading-tight transition-colors duration-700',
              isEnabled ? 'text-foreground/90' : 'text-muted-foreground/40'
            )}>
              {rule.trigger.type === 'time'
                ? t('automations.summary.clock_hits', { time: rule.trigger.timeLocal || rule.trigger.time })
                : t('automations.summary.when_device', { name: getDeviceName(rule.trigger.deviceId), value: rule.trigger.expectedValue })}
            </p>
            <span className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-30 mt-1.5 block">
              {t('automations.summary.trigger_label')}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-5 relative z-10">
          <div className={cn(
            'h-8 px-4 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all duration-700',
            isEnabled
              ? (isFullyAutonomous ? 'bg-success text-success-foreground premium-glow-success' : 'bg-primary text-primary-foreground premium-glow')
              : 'bg-muted text-muted-foreground/30'
          )}>
            <span className="text-[9px] font-black tracking-tighter">{t('automations.summary.then')}</span>
          </div>
          <div className="pt-0.5">
            <p className={cn(
              'text-lg font-black tracking-tight leading-tight transition-all duration-700',
              isEnabled ? (isFullyAutonomous ? 'text-success' : 'text-primary') : 'text-muted-foreground/40'
            )}>
              {rule.action.type === 'device_command'
                ? t('automations.summary.run_command', {
                    command: t(`automations.builder.commands.${rule.action.command}`, { defaultValue: rule.action.command || '' }).toUpperCase(),
                    name: getDeviceName(rule.action.targetDeviceId),
                  })
                : t('automations.summary.run_scene', { name: getSceneName(rule.action.sceneId) })}
            </p>
            <span className={cn(
              'text-[8px] font-black uppercase tracking-[0.25em] mt-1.5 block transition-colors duration-700',
              isEnabled ? (isFullyAutonomous ? 'text-success/50' : 'text-primary/50') : 'text-muted-foreground/30'
            )}>
              {t('automations.summary.action_label')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isEnabled ? (isFullyAutonomous ? 'bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]') : 'bg-muted-foreground/20'
          )} />
          <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-40">
            {isFullyAutonomous ? 'Verified Hardware Autonomy' : (isEnabled ? t('automations.summary.system_rule') : t('automations.summary.inactive_automation'))}
          </span>
        </div>
        <div className="flex items-center gap-1.5 opacity-10 grayscale">
          <Cpu className="w-3 h-3" />
          <span className="text-[7.5px] font-bold uppercase tracking-tighter">Nezu Core v1</span>
        </div>
      </div>
    </div>
  );
};
