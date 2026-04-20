import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Clock, Zap, AlertCircle, 
  Pencil, ArrowRight, Loader2, CheckCircle2, Cpu
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import AutomationBuilderModal from './AutomationBuilderModal.tsx';
import ConfirmModal from './ConfirmModal.tsx';
import { humanize } from '../lib/naming-utils';
import { cn } from '../lib/utils';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'device_state_changed' | 'time';
    deviceId?: string;
    stateKey?: string;
    expectedValue?: any;
    time?: string;
    timeLocal?: string;
    timezone?: string;
    timeUTC?: string;
    days?: number[];
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
  name: string;
  integrationSource?: string;
  updatedAt?: string;
}

interface Scene {
  id: string;
  name: string;
  actions?: { deviceId: string; command: string }[];
}

const AutomationsView: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchJSON = async (url: string, options?: RequestInit) => {
    const res = await apiFetch(url, options);
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type');
    if (!res.ok) {
      if (contentType && contentType.includes('application/json')) {
        const err = await res.json();
        throw new Error(err.message || `Server error: ${res.status}`);
      }
      throw new Error(`Server returned ${res.status} (${res.statusText})`);
    }
    if (!contentType || !contentType.includes('application/json')) return null;
    return res.json();
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, devicesData, scenesData] = await Promise.all([
        fetchJSON(API_ENDPOINTS.automations.list),
        fetchJSON(API_ENDPOINTS.devices.list),
        fetchJSON(API_ENDPOINTS.scenes.list)
      ]);
      if (Array.isArray(rulesData)) setRules(rulesData);
      if (Array.isArray(devicesData)) setDevices(devicesData);
      if (Array.isArray(scenesData)) setScenes(scenesData);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('common.errors.connection_error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleRule = async (id: string, currentlyEnabled: boolean) => {
    if (processingId) return;
    setProcessingId(id);
    const action = currentlyEnabled ? 'disable' : 'enable';
    try {
      await fetchJSON(`${API_BASE_URL}/api/v1/automations/${id}/${action}`, { method: 'PATCH' });
      setRules(rules.map(r => r.id === id ? { ...r, enabled: !currentlyEnabled } : r));
    } catch (err: any) {
      setError(err.message || t('common.errors.operation_failed'));
    } finally {
      setProcessingId(null);
    }
  };

  const deleteRule = async (id: string) => {
    if (deletingId === id) return;
    setDeletingId(id);
    setIsDeleting(true);
    try {
      await fetchJSON(`${API_BASE_URL}/api/v1/automations/${id}`, { method: 'DELETE' });
      setRules(prev => prev.filter(r => r.id !== id));
      setConfirmDeleteId(null);
      setNotification({ message: t('automations.notifications.deleted'), type: 'success' });
    } catch (err: any) {
      setError(err.message || t('common.errors.operation_failed'));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const getDeviceName = (id?: string) => {
    const d = devices.find(dev => dev.id === id);
    return d ? humanize(d.id, d.name) : (id || t('common.unknown'));
  };
  const getSceneName = (id?: string) => scenes.find(s => s.id === id)?.name || id || t('common.unknown_scene');

  if (isLoading && rules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="premium-shimmer w-32 h-32 rounded-full absolute opacity-20" />
        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">{t('common.loading')}</p>
      </div>
    );
  }

  const RuleCard = ({ rule }: { rule: AutomationRule }) => {
    const isEnabled = rule.enabled;
    const isWorking = processingId === rule.id;

    // Resilience Detection
    const triggerDevice = devices.find(d => d.id === rule.trigger.deviceId);
    const actionDevice = devices.find(d => d.id === rule.action.targetDeviceId);
    const targetScene = scenes.find(s => s.id === rule.action.sceneId);
    
    let isFullyAutonomous = false;
    let isEdgeCapable = false;

    const isDeviceLocal = (d?: Device) => d?.integrationSource === 'sonoff';
    
    const triggerIsLocal = rule.trigger.type === 'time' || isDeviceLocal(triggerDevice);
    
    let actionIsLocal = false;
    if (rule.action.type === 'device_command') {
      actionIsLocal = isDeviceLocal(actionDevice);
    } else if (rule.action.type === 'execute_scene' && targetScene?.actions) {
      const sceneDevices = targetScene.actions.map(a => devices.find(d => d.id === a.deviceId));
      actionIsLocal = sceneDevices.every(isDeviceLocal);
      const someLocal = sceneDevices.some(isDeviceLocal);
      if (someLocal) isEdgeCapable = true;
    }

    isFullyAutonomous = triggerIsLocal && actionIsLocal;
    isEdgeCapable = isEdgeCapable || triggerIsLocal || actionIsLocal;

    const resilienceLabel = isFullyAutonomous ? "Autonomous" : (isEdgeCapable ? "Edge Capable" : "Bridged");

    return (
      <div 
        className={cn(
          "group relative overflow-hidden bg-card/40 backdrop-blur-xl rounded-[2.5rem] border transition-all duration-700",
          isEnabled 
            ? "border-primary/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] p-7" 
            : "border-border/10 opacity-60 p-7 grayscale hover:grayscale-0 hover:opacity-100"
        )}
      >
        {/* State Indicator Glow */}
        {isEnabled && (
          <div className={cn(
            "absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000",
            isFullyAutonomous ? "bg-success" : "bg-primary"
          )} />
        )}

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 relative overflow-hidden",
              isEnabled 
                ? (isFullyAutonomous ? "bg-success text-white premium-glow-success shadow-lg shadow-success/20" : "bg-primary text-white premium-glow shadow-lg shadow-primary/20") 
                : "bg-muted text-muted-foreground"
            )}>
              {rule.trigger.type === 'time' ? <Clock className="w-6 h-6 relative z-10" /> : <Zap className="w-6 h-6 relative z-10" />}
            </div>
            <div>
               <div className="flex items-center gap-2 mb-0.5">
                 <h4 className="text-xl font-black tracking-tight leading-tight">{rule.name}</h4>
                 {isEnabled && (
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0 bg-background/40 backdrop-blur-md",
                      isFullyAutonomous ? "border-success/30 text-success" : 
                      (isEdgeCapable ? "border-primary/30 text-primary" : "border-border/30 text-muted-foreground opacity-40")
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
                onClick={() => toggleRule(rule.id, isEnabled)}
                disabled={isWorking}
                className={cn(
                  "h-10 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm",
                  isEnabled 
                    ? (isFullyAutonomous ? "bg-success/10 text-success border border-success/10" : "bg-primary/10 text-primary border border-primary/10") 
                    : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
             >
                {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEnabled ? t('automations.summary.active') : t('automations.summary.paused'))}
             </button>
             <button 
                onClick={() => { setEditingAutomation(rule); setIsBuilderOpen(true); }}
                className="w-10 h-10 flex items-center justify-center bg-muted/40 hover:bg-muted rounded-xl transition-all border border-transparent hover:border-border/20"
             >
                <Pencil className="w-4 h-4 text-muted-foreground" />
             </button>
             <button 
                onClick={() => setConfirmDeleteId(rule.id)}
                className="w-10 h-10 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all opacity-0 group-hover:opacity-100"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="relative p-6 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] flex flex-col gap-8">
           {/* Logic Flow Line - More structured */}
           <div className="absolute left-[2.35rem] top-12 bottom-12 w-[1px] bg-gradient-to-b from-border/20 via-primary/20 to-border/20" />

           <div className="flex items-start gap-5 relative z-10">
              <div className={cn(
                "h-8 px-3 rounded-full flex items-center justify-center shrink-0 shadow-sm border transition-all duration-700",
                isEnabled ? "bg-background border-border" : "bg-muted/50 border-transparent"
              )}>
                 <span className={cn("text-[9px] font-black tracking-tighter", isEnabled ? "opacity-40" : "opacity-20")}>{t('automations.summary.if')}</span>
              </div>
              <div className="pt-0.5">
                <p className={cn(
                  "text-lg font-black tracking-tight leading-tight transition-colors duration-700",
                  isEnabled ? "text-foreground/90" : "text-muted-foreground/40"
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
                "h-8 px-4 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all duration-700",
                isEnabled 
                  ? (isFullyAutonomous ? "bg-success text-white premium-glow-success" : "bg-primary text-white premium-glow") 
                  : "bg-muted text-muted-foreground/30"
              )}>
                 <span className="text-[9px] font-black tracking-tighter">{t('automations.summary.then')}</span>
              </div>
              <div className="pt-0.5">
                <p className={cn(
                  "text-lg font-black tracking-tight leading-tight transition-all duration-700",
                  isEnabled ? (isFullyAutonomous ? "text-success" : "text-primary") : "text-muted-foreground/40"
                )}>
                   {rule.action.type === 'device_command'
                      ? t('automations.summary.run_command', { 
                          command: t(`automations.builder.commands.${rule.action.command}`, { defaultValue: rule.action.command || '' }).toUpperCase(), 
                          name: getDeviceName(rule.action.targetDeviceId) 
                        })
                      : t('automations.summary.run_scene', { name: getSceneName(rule.action.sceneId) })}
                </p>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-[0.25em] mt-1.5 block transition-colors duration-700",
                  isEnabled ? (isFullyAutonomous ? "text-success/50" : "text-primary/50") : "text-muted-foreground/30"
                )}>
                  {t('automations.summary.action_label')}
                </span>
              </div>
           </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full", 
                isEnabled ? (isFullyAutonomous ? "bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]") : "bg-muted-foreground/20"
              )} />
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-40">
                 {isFullyAutonomous ? "Verified Hardware Autonomy" : (isEnabled ? t('automations.summary.system_rule') : t('automations.summary.inactive_automation'))}
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

  return (
    <div className="flex flex-col gap-12 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-700 px-2 lg:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
        <div>
          <h2 className="text-4xl font-black tracking-tighter leading-none mb-2">{t('automations.header.title')}</h2>
          <p className="text-sm font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
             {t('automations.header.subtitle', { count: rules.filter(r => r.enabled).length })}
          </p>
        </div>
        <button 
          onClick={() => setIsBuilderOpen(true)}
          className="bg-primary text-primary-foreground px-10 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.03] active:scale-95 premium-glow shadow-primary/20 flex items-center gap-4"
        >
          <Plus className="w-6 h-6" />
          {t('automations.create_rule')}
        </button>
      </div>

      {error && (
        <div className="p-6 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center gap-4 text-destructive animate-shake">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="font-black text-xs uppercase tracking-wider">{error}</p>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-card/10 border-4 border-dashed border-border/20 rounded-[4rem]">
          <div className="p-12 bg-muted/20 rounded-full mb-8">
            <Zap className="w-16 h-16 text-muted-foreground opacity-20" />
          </div>
          <h3 className="text-3xl font-black tracking-tighter mb-4">{t('automations.empty_state.title')}</h3>
          <p className="text-muted-foreground max-w-sm font-medium mb-12 opacity-60 leading-relaxed">
            {t('automations.empty_state.description')}
          </p>
          <button 
            onClick={() => setIsBuilderOpen(true)}
            className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs group"
          >
            {t('automations.create_rule')} <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      )}

      {isBuilderOpen && (
        <AutomationBuilderModal 
          isOpen={isBuilderOpen}
          existingAutomation={editingAutomation}
          onClose={() => {
            setIsBuilderOpen(false);
            setEditingAutomation(null);
          }}
          onCreated={() => {
            setIsBuilderOpen(false);
            setEditingAutomation(null);
            fetchData();
            setNotification({ message: t('automations.notifications.updated'), type: 'success' });
          }}
          devices={devices}
          scenes={scenes}
        />
      )}

      {notification && (
        <div className="fixed bottom-12 right-12 z-[110] px-8 py-5 rounded-[2rem] shadow-2xl animate-in slide-in-from-right-8 fade-in flex items-center gap-4 border border-border/40 bg-card/80 backdrop-blur-2xl text-primary premium-glow">
          <CheckCircle2 className="w-6 h-6" />
          <span className="font-black text-xs uppercase tracking-widest">{notification.message}</span>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && deleteRule(confirmDeleteId)}
        title={t('automations.delete_confirm_title')}
        description={t('automations.delete_confirm_description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isSubmitting={isDeleting}
      />
    </div>
  );
};

export default AutomationsView;
