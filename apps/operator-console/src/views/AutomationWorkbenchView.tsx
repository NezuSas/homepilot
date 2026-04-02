import React, { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Zap, ArrowRight, Loader2, AlertCircle, RefreshCw, Ghost, Cpu, Plus, X, CheckCircle2, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';

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
 * Vista final endurecida para la gestión de reglas locales.
 */
export const AutomationWorkbenchView: React.FC = () => {
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

  const API_URL = 'http://localhost:3000/api/v1';

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/automations`);
      if (!res.ok) throw new Error('Error de conexión con el motor de reglas');
      const data = (await res.json()) as AutomationRule[];
      setRules(data.map(r => ({ ...r, _processing: false, _error: null, _confirmingDelete: false })));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de red fatal');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      if (res.ok) {
        const data = (await res.json()) as Device[];
        setDevices(data.filter(d => d.status === 'ASSIGNED'));
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
      const res = await fetch(`${API_URL}/automations/${id}/${act}`, { method: 'PATCH' });
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
      const res = await fetch(`${API_URL}/automations/${id}`, { method: 'DELETE' });
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
          expectedValue: formData.expectedValue === 'true' ? true : formData.expectedValue === 'false' ? false : formData.expectedValue
        },
        action: {
          targetDeviceId: formData.targetDeviceId,
          command: formData.command
        }
      };

      const method = editingId ? 'PATCH' : 'POST';
      const endpoint = editingId ? `${API_URL}/automations/${editingId}` : `${API_URL}/automations`;

      const res = await fetch(endpoint, {
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
      <span className="text-sm font-black uppercase tracking-widest">Sincronizando Workbench...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header with Create Button */}
      <div className="flex items-center justify-between bg-card/40 p-6 rounded-[2rem] border border-border/40 backdrop-blur-sm">
        <div className="flex flex-col">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            Automation Rules
          </h2>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{rules.length} Active Recipes</span>
        </div>
        <button 
          onClick={() => {
            if (editingId) cancelEditing();
            setShowForm(!showForm);
          }}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg",
            (showForm || editingId) ? "bg-muted text-foreground border" : "bg-primary text-white shadow-primary/20 hover:scale-105 active:scale-95"
          )}
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : editingId ? <><X className="w-4 h-4" /> Cancel Edit</> : <><Plus className="w-4 h-4" /> Create Rule</>}
        </button>
      </div>

      {/* Form (Creation or Edition) */}
      {(showForm || editingId) && (
        <form onSubmit={handleSubmit} className="bg-card border-2 border-primary/20 rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
          {success && (
            <div className="absolute inset-0 bg-primary/95 backdrop-blur-md flex flex-col items-center justify-center text-white z-10 animate-in fade-in">
              <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
              <span className="text-xl font-black uppercase tracking-tighter">{editingId ? 'Regla Actualizada' : 'Regla Creada Exitosamente'}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Rule Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Turn on Living Room Light on Motion"
                  className="bg-muted/30 border-2 border-border/40 rounded-2xl p-4 text-sm font-bold focus:border-primary/40 outline-none transition-all"
                />
              </div>

              <div className="p-8 bg-muted/20 rounded-[2.5rem] border border-border/40 flex flex-col gap-5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60 mb-2 flex items-center gap-2">
                  <Play className="w-3 h-3 fill-current" /> Trigger Configuration
                </span>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-muted-foreground">Source Device</label>
                  <select 
                    required
                    value={formData.triggerDeviceId}
                    onChange={e => setFormData({...formData, triggerDeviceId: e.target.value})}
                    className="bg-background border-2 border-border/40 rounded-xl p-3 text-xs font-bold outline-none focus:border-primary/40 appearance-none"
                  >
                    <option value="">Select Device...</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-muted-foreground">State Key</label>
                    <input 
                      required
                      value={formData.stateKey}
                      onChange={e => setFormData({...formData, stateKey: e.target.value})}
                      className="bg-background border-2 border-border/40 rounded-xl p-3 text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-bold text-muted-foreground">Value</label>
                    <input 
                      required
                      value={formData.expectedValue}
                      onChange={e => setFormData({...formData, expectedValue: e.target.value})}
                      className="bg-background border-2 border-border/40 rounded-xl p-3 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 justify-between">
              <div className="p-8 bg-primary/[0.03] rounded-[2.5rem] border-2 border-primary/10 flex flex-col gap-5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-current" /> Action Result
                </span>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-muted-foreground">Target Device</label>
                  <select 
                    required
                    value={formData.targetDeviceId}
                    onChange={e => setFormData({...formData, targetDeviceId: e.target.value})}
                    className="bg-background border-2 border-border/40 rounded-xl p-3 text-xs font-bold outline-none focus:border-primary/40 appearance-none"
                  >
                    <option value="">Select Target...</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-muted-foreground">Command</label>
                  <select 
                    required
                    value={formData.command}
                    onChange={e => setFormData({...formData, command: e.target.value})}
                    className="bg-primary text-white rounded-xl p-3 text-xs font-black uppercase tracking-widest outline-none shadow-lg shadow-primary/20 appearance-none text-center cursor-pointer"
                  >
                    <option value="turn_on">TURN ON</option>
                    <option value="turn_off">TURN OFF</option>
                    <option value="toggle">TOGGLE</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-auto">
                {createError && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold p-4 rounded-2xl flex items-center gap-3 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {createError}
                  </div>
                )}
                <button 
                  disabled={submitting}
                  type="submit"
                  className="w-full bg-primary text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{editingId ? 'UPDATE AUTOMATION' : 'SAVE AUTOMATION'} <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" /></>}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {rules.length === 0 && !loading && !showForm && !editingId ? (
        <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-[3rem] text-center p-12 bg-card/20">
          <Ghost className="w-16 h-16 text-muted-foreground opacity-10 mb-8" />
          <h3 className="text-2xl font-black tracking-tight">No hay reglas locales</h3>
          <p className="text-sm text-muted-foreground max-w-xs mt-3 mb-10 leading-relaxed font-medium">Crea tu primera regla usando el botón superior para empezar a automatizar tu hogar local.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {rules.map(rule => (
            <div key={rule.id} className={cn(
              "relative flex flex-col md:flex-row border border-border rounded-[2.5rem] bg-card overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5",
              !rule.enabled && "opacity-60 grayscale-[0.5]",
              rule._processing && "pointer-events-none cursor-wait",
              editingId === rule.id && "border-primary ring-2 ring-primary/20 shadow-2xl"
            )}>
              <div className={cn(
                "w-full md:w-56 p-10 flex flex-col items-center justify-center gap-5 border-b md:border-b-0 md:border-r border-border/40",
                rule.enabled ? "bg-primary/[0.03]" : "bg-muted/20"
              )}>
                 <div className={cn(
                   "p-6 rounded-[2rem] shadow-xl border-2 transition-all duration-700 transform group-hover:scale-110",
                   rule.enabled ? "bg-primary text-white border-primary/20" : "bg-background text-muted-foreground border-border"
                 )}>
                   {rule._processing ? <Loader2 className="w-8 h-8 animate-spin" /> : rule.enabled ? <Play className="fill-current w-8 h-8" /> : <Pause className="fill-current w-8 h-8" />}
                 </div>
                 <div className="flex flex-col w-full gap-2">
                   <button disabled={rule._processing} onClick={() => toggle(rule.id, rule.enabled)} className={cn(
                     "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                     rule.enabled ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white" : "bg-primary text-white"
                   )}>
                     {rule.enabled ? 'Disable' : 'Enable'}
                   </button>
                   
                   <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/40 mt-1.5">
                     <button 
                        onClick={() => startEditing(rule)}
                        disabled={rule._processing}
                        className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-colors"
                     >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                     </button>

                     {rule._confirmingDelete ? (
                       <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2">
                         <button onClick={() => handleDelete(rule.id)} className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-[9px] font-black uppercase tracking-tighter">Confirm</button>
                         <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, _confirmingDelete: false } : r))} className="px-3 py-2.5 bg-muted text-foreground rounded-xl text-[9px] font-black uppercase">X</button>
                       </div>
                     ) : (
                       <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, _confirmingDelete: true } : r))} className="w-full py-2 bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                       </button>
                     )}
                   </div>
                 </div>
                 {rule._error && <span className="absolute top-4 left-4 right-4 bg-destructive text-white text-[9px] font-black py-1.5 px-3 rounded-lg text-center animate-bounce shadow-xl">{rule._error}</span>}
              </div>
              <div className="flex-1 p-10 flex flex-col justify-center">
                 <div className="flex items-center gap-4 mb-8">
                    <Zap className={cn("w-6 h-6", rule.enabled ? "text-amber-500 fill-amber-500 animate-pulse" : "text-muted-foreground")} />
                    <div className="flex flex-col">
                      <h4 className="text-2xl font-black tracking-tighter text-foreground/90">{rule.name}</h4>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground/30">{rule.id}</span>
                    </div>
                 </div>
                 <div className="grid lg:grid-cols-[1fr,auto,1fr] gap-8 items-center">
                    <div className="p-7 bg-muted/20 border-2 border-border/30 rounded-[2rem] font-mono text-[11px] shadow-inner relative group/node">
                       <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border rounded-full text-[9px] font-black text-muted-foreground">IF TRIGGER</span>
                       <div className="font-bold flex flex-col gap-2 pt-2">
                         <span className="text-primary/40 italic">Device:</span> {rule.trigger.deviceId}
                         <div className="h-[1px] w-full bg-border/40" />
                         <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{rule.trigger.stateKey}</span> == {String(rule.trigger.expectedValue)}
                       </div>
                    </div>
                    <ArrowRight className="opacity-10 hidden lg:block" />
                    <div className="p-7 bg-primary/[0.02] border-2 border-primary/20 rounded-[2rem] font-mono text-[11px] relative">
                       <span className="absolute -top-3 left-6 px-3 py-0.5 bg-background border border-primary/20 rounded-full text-[9px] font-black text-primary/70">THEN ACTION</span>
                       <div className="font-bold flex flex-col gap-2 pt-2">
                          <span className="text-primary/40 italic">Target:</span> {rule.action.targetDeviceId}
                          <div className="h-[1px] w-full bg-primary/10" />
                          <div className="inline-flex items-center gap-2 py-1.5 px-3 bg-primary text-white rounded-lg self-start shadow-lg shadow-primary/20">
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
        <div className="fixed bottom-10 right-10 bg-destructive text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-4">
          <AlertCircle className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">{error}</span>
          <button onClick={fetchRules} className="bg-white/20 p-2 rounded-xl hover:bg-white/40 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
