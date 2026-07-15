import React from 'react';
import { AlertCircle, ArrowRight, Cpu, Edit2, Loader2, Pause, Play, Trash2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { StatusPill } from './ui/StatusPill';

export interface AutomationWorkbenchRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    deviceId: string;
    stateKey: string;
    expectedValue: string | number | boolean;
  };
  action: {
    targetDeviceId: string;
    command: string;
  };
  _processing?: boolean;
  _error?: string | null;
  _confirmingDelete?: boolean;
}

interface AutomationWorkbenchRuleCardProps {
  rule: AutomationWorkbenchRule;
  editingId: string | null;
  onToggle: (id: string, currentlyEnabled: boolean) => void;
  onEdit: (rule: AutomationWorkbenchRule) => void;
  onDelete: (id: string) => void;
  onConfirmingDeleteChange: (id: string, confirming: boolean) => void;
}

const getExpectedValueLabel = (value: string | number | boolean): string => {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).toUpperCase();
};

export const AutomationWorkbenchRuleCard: React.FC<AutomationWorkbenchRuleCardProps> = ({
  rule,
  editingId,
  onToggle,
  onEdit,
  onDelete,
  onConfirmingDeleteChange
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "relative flex flex-col md:flex-row border border-border rounded-dashboard bg-card overflow-hidden transition-all duration-500",
      !rule.enabled && "opacity-60 grayscale-[0.5]",
      rule._processing && "pointer-events-none opacity-80 backdrop-blur-sm",
      editingId === rule.id ? "border-primary ring-2 ring-primary/20 shadow-2xl scale-[1.02]" : "hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
    )}>
      {rule._processing && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-micro z-50 flex items-center justify-center rounded-dashboard animate-in fade-in">
          <div className="bg-card px-6 py-3 rounded-full shadow-2xl border border-primary/20 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-micro font-black uppercase tracking-widest text-primary">{t('common.processing')}</span>
          </div>
        </div>
      )}

      <div className={cn(
        "w-full md:w-56 p-10 flex flex-col items-center justify-center gap-5 border-b md:border-b-0 md:border-r border-border/40",
        rule.enabled ? "bg-primary/[0.03]" : "bg-muted/20"
      )}>
        <div className={cn(
          "p-6 rounded-panel shadow-xl border-2 transition-all duration-700 transform group-hover:scale-110",
          rule.enabled ? "bg-primary text-primary-foreground border-primary/20" : "bg-background text-muted-foreground border-border"
        )}>
          {rule.enabled ? <Play className="fill-current w-8 h-8" /> : <Pause className="fill-current w-8 h-8" />}
        </div>

        <div className="flex flex-col w-full gap-2">
          <button
            disabled={rule._processing}
            onClick={() => onToggle(rule.id, rule.enabled)}
            className={cn(
              "w-full py-2.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all active:scale-95",
              rule.enabled ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            {rule.enabled ? t('common.disable') : t('common.enable')}
          </button>

          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/40 mt-1.5">
            <button
              onClick={() => onEdit(rule)}
              disabled={rule._processing}
              className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-xl text-micro font-black uppercase flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>

            {rule._confirmingDelete ? (
              <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2">
                <button onClick={() => onDelete(rule.id)} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-micro font-black uppercase tracking-tighter shadow-lg shadow-destructive/20">Confirm</button>
                <button onClick={() => onConfirmingDeleteChange(rule.id, false)} className="px-3 py-2.5 bg-muted text-foreground rounded-xl text-micro font-black uppercase transition-colors hover:bg-muted/80">X</button>
              </div>
            ) : (
              <button
                onClick={() => onConfirmingDeleteChange(rule.id, true)}
                className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl text-micro font-black uppercase flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {rule._error && (
          <div className="absolute top-4 left-4 right-4 bg-destructive text-destructive-foreground text-micro font-black py-1.5 px-3 rounded-lg text-center animate-bounce shadow-xl flex items-center justify-center gap-2">
            <AlertCircle className="w-3 h-3" /> {rule._error}
          </div>
        )}
      </div>

      <div className="flex-1 p-10 flex flex-col justify-center">
        <div className="flex items-center gap-4 mb-8">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg",
            rule.enabled ? "bg-warning/10 text-warning shadow-warning/10" : "bg-muted text-muted-foreground"
          )}>
            <Zap className={cn("w-5 h-5", rule.enabled && "fill-warning animate-pulse")} />
          </div>
          <div className="flex flex-col">
            <h4 className="text-view-title font-black tracking-tighter text-foreground/90 leading-tight">{rule.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-micro font-mono font-bold text-muted-foreground/30 px-1.5 py-0.5 bg-muted/40 rounded uppercase tracking-tighter">ID: {rule.id}</span>
              {!rule.enabled && <span className="text-nano font-black text-destructive/40 uppercase tracking-widest border border-destructive/20 px-1.5 rounded-full">{t('automations.rule.inactive')}</span>}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr,auto,1fr] gap-8 items-center">
          <div className="p-7 bg-muted/20 border-2 border-border/30 rounded-panel font-mono text-label shadow-inner relative group/node overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-700" />
            <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border rounded-full text-micro font-black text-muted-foreground">{t('automations.rule.if_trigger')}</span>
            <div className="font-bold flex flex-col gap-2 pt-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-primary/40 italic">{t('automations.form.device_label')}</span>
                <span className="text-foreground/70">{rule.trigger.deviceId}</span>
              </div>
              <div className="h-hairline w-full bg-border/40" />
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill variant="primary">{rule.trigger.stateKey}</StatusPill>
                <span className="text-muted-foreground opacity-30">==</span>
                <StatusPill variant="warning">{getExpectedValueLabel(rule.trigger.expectedValue)}</StatusPill>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 opacity-20">
            <ArrowRight className="hidden lg:block w-6 h-6" />
            <div className="w-rule h-10 bg-primary lg:hidden" />
          </div>

          <div className="p-7 bg-primary/[0.02] border-2 border-primary/20 rounded-panel font-mono text-label relative shadow-sm group/node overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-700" />
            <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border border-primary/20 rounded-full text-micro font-black text-primary/70">{t('automations.rule.then_action')}</span>
            <div className="font-bold flex flex-col gap-2 pt-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-primary/40 italic">{t('automations.form.target_label')}</span>
                <span className="text-foreground/70">{rule.action.targetDeviceId}</span>
              </div>
              <div className="h-hairline w-full bg-primary/10" />
              <div className="inline-flex items-center gap-2 py-1.5 px-3 bg-primary text-primary-foreground rounded-xl self-start shadow-lg shadow-primary/20 border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                <Cpu className="w-3.5 h-3.5 opacity-60" />
                <span className="font-black uppercase tracking-tighter">{rule.action.command}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
