import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Clock, Zap, AlertCircle, 
  Pencil, ArrowRight, Loader2, CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
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
}

interface Scene {
  id: string;
  name: string;
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
    const res = await fetch(url, options);
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
      setRules(rulesData);
      setDevices(devicesData);
      setScenes(scenesData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Connection error');
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
      setError(err.message || 'Failed to toggle rule');
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
      setNotification({ message: 'Recipe removed from intelligence library', type: 'success' });
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const getDeviceName = (id?: string) => {
    const d = devices.find(dev => dev.id === id);
    return d ? humanize(d.id, d.name) : (id || 'Unknown');
  };
  const getSceneName = (id?: string) => scenes.find(s => s.id === id)?.name || id || 'Unknown Scene';

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

    return (
      <div 
        className={cn(
          "group relative overflow-hidden bg-card/60 backdrop-blur-md rounded-[3rem] border-2 transition-all duration-500",
          isEnabled ? "border-primary/20 shadow-2xl p-8" : "border-border/30 opacity-60 p-8 grayscale"
        )}
      >
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className={cn(
              "p-5 rounded-[1.8rem] transition-all duration-700",
              isEnabled ? "bg-primary text-primary-foreground premium-glow" : "bg-muted text-muted-foreground"
            )}>
              {rule.trigger.type === 'time' ? <Clock className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
            </div>
            <div>
               <h4 className="text-2xl font-black tracking-tighter leading-none mb-1">{rule.name}</h4>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                 {rule.trigger.type === 'time' ? 'Schedule Based' : 'Event Driven'}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={() => toggleRule(rule.id, isEnabled)}
                disabled={isWorking}
                className={cn(
                  "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                  isEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
             >
                {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEnabled ? 'Active' : 'Paused')}
             </button>
             <button 
                onClick={() => { setEditingAutomation(rule); setIsBuilderOpen(true); }}
                className="p-3 bg-muted/40 hover:bg-muted rounded-xl transition-all"
             >
                <Pencil className="w-4 h-4" />
             </button>
             <button 
                onClick={() => setConfirmDeleteId(rule.id)}
                className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all opacity-0 group-hover:opacity-100"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 bg-muted/20 rounded-[2rem] p-6 border border-border/20">
           <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0">
                 <span className="text-[10px] font-black">IF</span>
              </div>
              <p className="text-lg font-bold leading-tight pt-2">
                 {rule.trigger.type === 'time' 
                    ? `The clock hits ${rule.trigger.timeLocal || rule.trigger.time}` 
                    : `${getDeviceName(rule.trigger.deviceId)} changes to ${rule.trigger.expectedValue}`}
              </p>
           </div>
           
           <div className="pl-5 border-l-2 border-dashed border-border/40 ml-5 py-2">
              <ArrowRight className="w-5 h-5 text-primary opacity-40" />
           </div>

           <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                 <span className="text-[10px] font-black">THEN</span>
              </div>
              <p className="text-lg font-bold leading-tight pt-2">
                 {rule.action.type === 'device_command'
                    ? `${rule.action.command?.replace('_', ' ').toUpperCase()} ${getDeviceName(rule.action.targetDeviceId)}`
                    : `Execute the ${getSceneName(rule.action.sceneId)} scene`}
              </p>
           </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className={cn("w-2 h-2 rounded-full", isEnabled ? "bg-primary animate-pulse" : "bg-muted-foreground/30")} />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                 {isEnabled ? 'System Monitoring Rule' : 'Inactive Recipe'}
              </span>
           </div>
           <span className="text-[9px] font-bold text-muted-foreground opacity-20 uppercase">Intelligence V1</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-12 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-700 px-2 lg:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
        <div>
          <h2 className="text-4xl font-black tracking-tighter leading-none mb-2">Automations</h2>
          <p className="text-sm font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
             {rules.filter(r => r.enabled).length} Active Intelligence Rules • Local Execution
          </p>
        </div>
        <button 
          onClick={() => setIsBuilderOpen(true)}
          className="bg-primary text-primary-foreground px-10 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.03] active:scale-95 premium-glow shadow-primary/20 flex items-center gap-4"
        >
          <Plus className="w-6 h-6" />
          Create New Recipe
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
          <h3 className="text-3xl font-black tracking-tighter mb-4">The house is quiet</h3>
          <p className="text-muted-foreground max-w-sm font-medium mb-12 opacity-60 leading-relaxed">
            Your home hasn't learned any routines yet. Automations allow your environment to react to your life automatically.
          </p>
          <button 
            onClick={() => setIsBuilderOpen(true)}
            className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs group"
          >
            Teach it something new <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
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
            setNotification({ message: 'Intelligence library updated', type: 'success' });
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
        title="Remove Intelligence Recipe?"
        description="This will permanently delete this automation pattern. This action is irreversible."
        confirmText="Confirm Delete"
        cancelText={t('common.cancel')}
        isSubmitting={isDeleting}
      />
    </div>
  );
};

export default AutomationsView;
