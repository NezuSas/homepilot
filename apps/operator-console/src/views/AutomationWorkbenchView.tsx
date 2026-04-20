import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Zap, ArrowRight, Loader2, AlertCircle, RefreshCw, Ghost, Cpu, Plus, X, CheckCircle2, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusPill } from '../components/ui/StatusPill';


/**
 * Tipado estricto para AutomationRule V1.
 */
interface AutomationRule {
  id: string;
  homeId: string;
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
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Proptypes extendidas para el manejo de estado en la UI.
 */
interface RuleUI extends AutomationRule {
  _processing?: boolean;
  _error?: string | null;
  _confirmingDelete?: boolean;
}

/**
 * AutomationWorkbenchView
 * Vista final endurecida y pulida para la gestión de reglas locales.
 */
export const AutomationWorkbenchView: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<RuleUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para creación y edición
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    triggerDeviceId: '',
    stateKey: 'occupancy',
    expectedValue: 'true',
    targetDeviceId: '',
    command: 'turn_on'
  });

  const API_URL = `${API_BASE_URL}/api/v1`;


  /**
   * Helper robusto para parsear el expectedValue desde el input string.
   * Soporta: "true" (boolean), "false" (boolean), números y strings.
   */
  const parseExpectedValue = (val: string): string | number | boolean => {
    const raw = val.trim();
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') return num;
    
    return raw;
  };

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_URL}/automations`);
      if (!res.ok) throw new Error('Error de conexión con el motor de reglas');
      const rawData = await res.json();
      if (Array.isArray(rawData)) {
        setRules(rawData.map(r => ({ ...r, _processing: false, _error: null, _confirmingDelete: false })));
        setError(null);
      } else {
        console.error('[AutomationWorkbench] Expected array of rules but received:', rawData);
        setError(t('common.error_invalid_response_shape'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de red fatal');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/devices`);
      if (res.ok) {
        const rawData = await res.json();
        if (Array.isArray(rawData)) {
          setDevices(rawData.filter(d => d.status === 'ASSIGNED'));
        } else {
          console.warn('[AutomationWorkbench] Expected array of devices but received:', rawData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch devices for form', err);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchDevices();
  }, [fetchRules, fetchDevices]);

  const toggle = async (id: string, currentlyEnabled: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: true, _error: null } : r));
    try {
      const act = currentlyEnabled ? 'disable' : 'enable';
      const res = await apiFetch(`${API_URL}/automations/${id}/${act}`, { method: 'PATCH' });
      const data = (await res.json()) as AutomationRule | { error: string };

      if (!res.ok) throw new Error('error' in data ? data.error : 'Fallo en la operación');
      
      const updated = data as AutomationRule;
      setRules(prev => prev.map(r => r.id === id ? { ...updated, _processing: false, _error: null } : r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: false, _error: msg } : r));
    }
  };

  const handleDelete = async (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: true, _error: null } : r));
    try {
      const res = await apiFetch(`${API_URL}/automations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || 'Error al eliminar la regla');
      }
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: false, _error: msg, _confirmingDelete: false } : r));
    }
  };

  const startEditing = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setShowForm(false);
    setFormData({
      name: rule.name,
      triggerDeviceId: rule.trigger.deviceId,
      stateKey: rule.trigger.stateKey,
      expectedValue: String(rule.trigger.expectedValue),
      targetDeviceId: rule.action.targetDeviceId,
      command: rule.action.command
    });
    setCreateError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ name: '', triggerDeviceId: '', stateKey: 'occupancy', expectedValue: 'true', targetDeviceId: '', command: 'turn_on' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        name: formData.name,
        trigger: {
          deviceId: formData.triggerDeviceId,
          stateKey: formData.stateKey,
          expectedValue: parseExpectedValue(formData.expectedValue)
        },
        action: {
          targetDeviceId: formData.targetDeviceId,
          command: formData.command
        }
      };

      const method = editingId ? 'PATCH' : 'POST';
      const endpoint = editingId ? `${API_URL}/automations/${editingId}` : `${API_URL}/automations`;

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as AutomationRule | { error: string };

      if (!res.ok) throw new Error('error' in data ? data.error : 'Error en la operación');

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', triggerDeviceId: '', stateKey: 'occupancy', expectedValue: 'true', targetDeviceId: '', command: 'turn_on' });
        fetchRules();
      }, 1500);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Fallo catastrófico');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && rules.length === 0) return (
    <div className="p-20 text-center flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
      <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      <span className="text-sm font-black uppercase tracking-widest">{t('automations.loading')}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header with Create Button */}
      <SectionHeader 
        className="bg-card/40 p-6 rounded-[2rem] border border-border/40 backdrop-blur-sm shadow-sm"
        title={t('automations.title')}
        subtitle={t('automations.active_recipes', { count: rules.length })}
        icon={Zap}
        iconClassName="text-warning fill-warning"
        action={
          <Button
            variant={(showForm || editingId) ? 'outline' : 'primary'}
            onClick={() => {
              if (editingId) cancelEditing();
              setShowForm(!showForm);
            }}
            className="uppercase tracking-widest text-[11px]"
          >
            {showForm || editingId ? <><X className="w-4 h-4" /> {t('common.cancel')}</> : <><Plus className="w-4 h-4" /> {t('automations.create_rule')}</>}
          </Button>
        }
      />

      {/* Form (Creation or Edition) */}
      {(showForm || editingId) && (
        <form onSubmit={handleSubmit} className="bg-card border-2 border-primary/20 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
          {success && (
            <div className="absolute inset-0 bg-primary/95 backdrop-blur-md flex flex-col items-center justify-center text-white z-10 animate-in fade-in transition-all">
              <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
              <span className="text-xl font-black uppercase tracking-tighter">{editingId ? t('automations.rule_updated') : t('automations.rule_created')}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Input 
                  label={t('automations.form.rule_name')}
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Turn on Living Room Light on Motion"
                />
              </div>

              <div className="p-8 bg-muted/20 rounded-[2.5rem] border border-border/40 flex flex-col gap-5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-2 flex items-center gap-2">
                  <Play className="w-3 h-3 fill-current" /> {t('automations.form.trigger_config')}
                </span>
                
                <Select 
                  label={t('automations.form.source_device')}
                  required
                  value={formData.triggerDeviceId}
                  onChange={e => setFormData({...formData, triggerDeviceId: e.target.value})}
                >
                  <option value="">{t('automations.form.select_device')}</option>
                  {Array.isArray(devices) && devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                </Select>

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label={t('automations.form.state_key')}
                    required
                    value={formData.stateKey}
                    onChange={e => setFormData({...formData, stateKey: e.target.value})}
                    className="font-mono"
                  />
                  <Input 
                    label={t('automations.form.value_label')}
                    required
                    value={formData.expectedValue}
                    onChange={e => setFormData({...formData, expectedValue: e.target.value})}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 justify-between">
              <div className="p-8 bg-primary/[0.03] rounded-[2.5rem] border-2 border-primary/10 flex flex-col gap-5 shadow-inner">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-current" /> {t('automations.form.action_result')}
                </span>

                <Select 
                  label={t('automations.form.target_device')}
                  required
                  value={formData.targetDeviceId}
                  onChange={e => setFormData({...formData, targetDeviceId: e.target.value})}
                >
                  <option value="">{t('automations.form.select_target')}</option>
                  {Array.isArray(devices) && devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                </Select>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-muted-foreground">{t('automations.form.command')}</label>
                  <select 
                    required
                    value={formData.command}
                    onChange={e => setFormData({...formData, command: e.target.value})}
                    className="bg-primary text-primary-foreground rounded-xl p-3 text-xs font-black uppercase tracking-widest outline-none shadow-lg shadow-primary/20 appearance-none text-center cursor-pointer active:scale-95 transition-transform"
                  >
                    <option value="turn_on">{t('common.on')}</option>
                    <option value="turn_off">{t('common.off')}</option>
                    <option value="toggle">{t('common.actions.toggle')}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-auto">
                {createError && (
                  <div className="bg-danger/10 border border-danger/20 text-danger text-[10px] font-bold p-4 rounded-2xl flex items-center gap-3 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {createError}
                  </div>
                )}
                <Button 
                  disabled={submitting}
                  type="submit"
                  size="lg"
                  className="w-full text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 group"
                  isLoading={submitting}
                >
                  <>{editingId ? t('automations.update_button') : t('automations.save_button')} <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" /></>
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {rules.length === 0 && !loading && !showForm && !editingId ? (
        <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-[3rem] text-center p-12 bg-card/20 animate-in fade-in duration-1000">
          <Ghost className="w-16 h-16 text-muted-foreground opacity-10 mb-8" />
          <h3 className="text-2xl font-black tracking-tight">{t('automations.empty_state.title')}</h3>
          <p className="text-sm text-muted-foreground max-w-xs mt-3 mb-10 leading-relaxed font-medium">{t('automations.empty_state.description')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.isArray(rules) && rules.map(rule => (
            <div key={rule.id} className={cn(
              "relative flex flex-col md:flex-row border border-border rounded-[2.5rem] bg-card overflow-hidden transition-all duration-500",
              !rule.enabled && "opacity-60 grayscale-[0.5]",
              rule._processing && "pointer-events-none opacity-80 backdrop-blur-sm",
              editingId === rule.id ? "border-primary ring-2 ring-primary/20 shadow-2xl scale-[1.02]" : "hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
            )}>
              {/* Overlay for processing states */}
              {rule._processing && (
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[2.5rem] animate-in fade-in">
                  <div className="bg-card px-6 py-3 rounded-full shadow-2xl border border-primary/20 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('common.processing')}</span>
                  </div>
                </div>
              )}

              <div className={cn(
                "w-full md:w-56 p-10 flex flex-col items-center justify-center gap-5 border-b md:border-b-0 md:border-r border-border/40",
                rule.enabled ? "bg-primary/[0.03]" : "bg-muted/20"
              )}>
                 <div className={cn(
                   "p-6 rounded-[2rem] shadow-xl border-2 transition-all duration-700 transform group-hover:scale-110",
                   rule.enabled ? "bg-primary text-white border-primary/20" : "bg-background text-muted-foreground border-border"
                 )}>
                   {rule.enabled ? <Play className="fill-current w-8 h-8" /> : <Pause className="fill-current w-8 h-8" />}
                 </div>
                 
                 <div className="flex flex-col w-full gap-2">
                   <button 
                     disabled={rule._processing} 
                     onClick={() => toggle(rule.id, rule.enabled)} 
                     className={cn(
                       "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                       rule.enabled ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white" : "bg-primary text-white"
                     )}
                   >
                     {rule.enabled ? t('common.disable') : t('common.enable')}
                   </button>
                   
                   <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/40 mt-1.5">
                     <button 
                        onClick={() => startEditing(rule)}
                        disabled={rule._processing}
                        className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-colors active:scale-95"
                     >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                     </button>

                     {rule._confirmingDelete ? (
                       <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2">
                         <button onClick={() => handleDelete(rule.id)} className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-[9px] font-black uppercase tracking-tighter shadow-lg shadow-destructive/20">Confirm</button>
                         <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, _confirmingDelete: false } : r))} className="px-3 py-2.5 bg-muted text-foreground rounded-xl text-[9px] font-black uppercase transition-colors hover:bg-muted/80">X</button>
                       </div>
                     ) : (
                       <button 
                          onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, _confirmingDelete: true } : r))} 
                          className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-colors active:scale-95"
                       >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                       </button>
                     )}
                   </div>
                 </div>
                 {rule._error && (
                   <div className="absolute top-4 left-4 right-4 bg-destructive text-white text-[9px] font-black py-1.5 px-3 rounded-lg text-center animate-bounce shadow-xl flex items-center justify-center gap-2">
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
                      <h4 className="text-2xl font-black tracking-tighter text-foreground/90 leading-tight">{rule.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono font-bold text-muted-foreground/30 px-1.5 py-0.5 bg-muted/40 rounded uppercase tracking-tighter">ID: {rule.id}</span>
                        {!rule.enabled && <span className="text-[8px] font-black text-destructive/40 uppercase tracking-widest border border-destructive/20 px-1.5 rounded-full">{t('automations.rule.inactive')}</span>}
                      </div>
                    </div>
                 </div>

                 <div className="grid lg:grid-cols-[1fr,auto,1fr] gap-8 items-center">
                    <div className="p-7 bg-muted/20 border-2 border-border/30 rounded-[2rem] font-mono text-[11px] shadow-inner relative group/node overflow-hidden">
                       <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-700" />
                       <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border rounded-full text-[9px] font-black text-muted-foreground">{t('automations.rule.if_trigger')}</span>
                       <div className="font-bold flex flex-col gap-2 pt-2 relative z-10">
                         <div className="flex items-center gap-2">
                           <span className="text-primary/40 italic">{t('automations.form.device_label')}</span> 
                           <span className="text-foreground/70">{rule.trigger.deviceId}</span>
                         </div>
                         <div className="h-[1px] w-full bg-border/40" />
                         <div className="flex items-center gap-2 flex-wrap">
                           <StatusPill variant="primary">{rule.trigger.stateKey}</StatusPill> 
                           <span className="text-muted-foreground opacity-30">==</span> 
                           <StatusPill variant="warning">
                             {typeof rule.trigger.expectedValue === 'boolean' ? (rule.trigger.expectedValue ? 'TRUE' : 'FALSE') : String(rule.trigger.expectedValue).toUpperCase()}
                           </StatusPill>
                         </div>
                       </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 opacity-20">
                      <ArrowRight className="hidden lg:block w-6 h-6" />
                      <div className="w-[2px] h-10 bg-primary lg:hidden" />
                    </div>

                    <div className="p-7 bg-primary/[0.02] border-2 border-primary/20 rounded-[2rem] font-mono text-[11px] relative shadow-sm group/node overflow-hidden">
                       <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-700" />
                       <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border border-primary/20 rounded-full text-[9px] font-black text-primary/70">{t('automations.rule.then_action')}</span>
                       <div className="font-bold flex flex-col gap-2 pt-2 relative z-10">
                          <div className="flex items-center gap-2">
                             <span className="text-primary/40 italic">{t('automations.form.target_label')}</span> 
                             <span className="text-foreground/70">{rule.action.targetDeviceId}</span>
                          </div>
                          <div className="h-[1px] w-full bg-primary/10" />
                          <div className="inline-flex items-center gap-2 py-1.5 px-3 bg-primary text-white rounded-xl self-start shadow-lg shadow-primary/20 border border-white/10 group-hover:scale-105 transition-transform duration-300">
                             <Cpu className="w-3.5 h-3.5 opacity-60" />
                             <span className="font-black uppercase tracking-tighter">{rule.action.command}</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && rules.length > 0 && (
        <div className="fixed bottom-10 right-10 bg-destructive text-white p-5 rounded-[2rem] shadow-2xl flex items-center gap-5 animate-in slide-in-from-right-4 z-[100] border border-white/20 backdrop-blur-md">
          <AlertCircle className="w-6 h-6" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('common.error')}</span>
            <span className="text-xs font-bold">{error}</span>
          </div>
          <button onClick={fetchRules} className="bg-white/20 p-2.5 rounded-2xl hover:bg-white/40 transition-colors shadow-inner">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
