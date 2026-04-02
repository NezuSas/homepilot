import React, { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Zap, ArrowRight, Loader2, AlertCircle, RefreshCw, Database, Ghost, Cpu } from 'lucide-react';
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

/**
 * Proptypes extendidas para el manejo de estado en la UI.
 */
interface RuleUI extends AutomationRule {
  _processing?: boolean;
  _error?: string | null;
}

/**
 * AutomationWorkbenchView
 * Vista final endurecida para la gestión de reglas locales.
 */
export const AutomationWorkbenchView: React.FC = () => {
  const [rules, setRules] = useState<RuleUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://localhost:3000/api/v1';

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/automations`);
      if (!res.ok) throw new Error('Error de conexión con el motor de reglas');
      const data = await res.json() as AutomationRule[];
      setRules(data.map(r => ({ ...r, _processing: false, _error: null })));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de red fatal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggle = async (id: string, currentlyEnabled: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: true, _error: null } : r));
    try {
      const act = currentlyEnabled ? 'disable' : 'enable';
      const res = await fetch(`${API_URL}/automations/${id}/${act}`, { method: 'PATCH' });
      const data = await res.json() as AutomationRule | { error: string };

      if (!res.ok) throw new Error('error' in data ? data.error : 'Fallo en la operación');
      
      const updated = data as AutomationRule;
      setRules(prev => prev.map(r => r.id === id ? { ...updated, _processing: false, _error: null } : r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: false, _error: msg } : r));
    }
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
      <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      <span className="text-sm font-black uppercase tracking-widest">Sincronizando Workbench...</span>
    </div>
  );

  if (error) return (
    <div className="p-12 bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-[3rem] text-center max-w-2xl mx-auto">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-6" />
      <h3 className="text-xl font-black text-destructive/80 mb-2">Error de Comunicación</h3>
      <p className="text-sm text-muted-foreground mb-8">{error}</p>
      <button onClick={fetchRules} className="px-8 py-3 bg-destructive text-white rounded-2xl text-xs font-black hover:scale-105 transition-transform shadow-lg shadow-destructive/20">REINTENTAR</button>
    </div>
  );

  if (rules.length === 0) return (
    <div className="flex flex-col items-center justify-center h-[500px] border-2 border-dashed rounded-[3rem] text-center p-12 bg-card/20 animate-in fade-in zoom-in-95 duration-700">
      <Ghost className="w-16 h-16 text-muted-foreground opacity-10 mb-8" />
      <h3 className="text-2xl font-black tracking-tight">No hay reglas locales</h3>
      <p className="text-sm text-muted-foreground max-w-xs mt-3 mb-10 leading-relaxed font-medium">Utiliza el comando de seeding para poblar tu base de datos local y ver el workbench en acción.</p>
      <div className="flex items-center gap-4 px-8 py-4 bg-muted/40 rounded-2xl border font-mono text-[11px] font-black text-foreground/70 shadow-inner group transition-all hover:border-primary/20">
         <Database className="w-4 h-4 text-primary opacity-30 group-hover:opacity-100" />
         <span className="select-all">npm run db:seed</span>
      </div>
      <button onClick={fetchRules} className="mt-10 text-primary text-[10px] font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4 flex items-center gap-2">
         <RefreshCw className="w-3 h-3" /> Sincronizar motor
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      {rules.map(rule => (
        <div key={rule.id} className={cn(
          "relative flex flex-col md:flex-row border border-border rounded-[2.5rem] bg-card overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5",
          !rule.enabled && "opacity-60 grayscale-[0.5]",
          rule._processing && "pointer-events-none cursor-wait"
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
             <button disabled={rule._processing} onClick={() => toggle(rule.id, rule.enabled)} className={cn(
               "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               rule.enabled ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white" : "bg-primary text-white"
             )}>
               {rule.enabled ? 'Disable' : 'Enable'}
             </button>
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
                     <span className="text-primary/40 italic">Sensor:</span> {rule.trigger.deviceId}
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
  );
};
