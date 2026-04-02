import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldAlert, AlertCircle, Database, Clock, Zap, Info } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Registro de actividad atómico para la UI.
 */
interface ActivityRecord {
  timestamp: string;
  deviceId: string;
  type: string;
  description: string;
  data: Record<string, unknown>;
}

/**
 * AuditLogsView
 * Vista técnica para la observabilidad del sistema local.
 */
export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3000/api/v1/activity-logs');
      if (!res.ok) throw new Error('No se pudo sincronizar el historial técnico');
      const data = await res.json() as ActivityRecord[];
      setLogs(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fallo en la comunicación con el Edge');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground animate-pulse">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary/40" />
        <p className="text-sm font-black uppercase tracking-widest italic">Recuperando registros de auditoría...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-[3rem] text-center max-w-3xl mx-auto mt-10">
        <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-6" />
        <h3 className="text-xl font-black text-destructive/80 mb-2">Error de Observabilidad</h3>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{error}</p>
        <button 
           onClick={fetchLogs}
           className="px-8 py-3 bg-destructive text-white rounded-2xl text-xs font-black hover:scale-105 transition-transform"
        >
          REINTENTAR SINCRONIZACIÓN
        </button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] border-2 border-dashed border-border/40 rounded-[3rem] bg-card/10 p-12 text-center">
        <div className="relative mb-10">
           <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl animate-pulse" />
           <ShieldAlert className="relative w-16 h-16 text-muted-foreground/30" />
        </div>
        <h3 className="text-2xl font-black text-foreground/80 mb-4">Registro Vacío</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-10 leading-relaxed font-medium">
          Aún no se han generado eventos auditables en este Edge. 
          Realiza acciones como asignar dispositivos o ejecutar comandos para ver actividad técnica aquí.
        </p>
        <button 
          onClick={fetchLogs}
          className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
        >
          Refrescar estado
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-primary opacity-40 px-0.5" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Auditoría Técnica V1</span>
         </div>
         <button onClick={fetchLogs} className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            LIVE UPDATE
         </button>
      </div>

      <div className="grid gap-3">
        {logs.map((log, i) => (
          <div key={`${log.timestamp}-${i}`} className="group flex flex-col md:flex-row border border-border/50 bg-card hover:border-primary/30 transition-all rounded-2xl overflow-hidden shadow-sm">
            {/* Metadata Col */}
            <div className="w-full md:w-56 p-5 bg-muted/20 border-b md:border-b-0 md:border-r border-border/30 flex flex-col justify-center gap-2">
               <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-mono font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
               </div>
               <div className={cn(
                 "text-[9px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg self-start border",
                 log.type.includes('FAILED') ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/5 text-primary border-primary/10"
               )}>
                 {log.type.replace('_', ' ')}
               </div>
               <span className="text-[10px] font-mono text-muted-foreground italic mt-1">{new Date(log.timestamp).toLocaleDateString()}</span>
            </div>

            {/* Content Col */}
            <div className="flex-1 p-5 flex flex-col justify-center gap-4">
               <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-primary opacity-40" />
                  <p className="text-sm font-bold tracking-tight text-foreground/90">{log.description}</p>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/40 rounded-xl border border-border/40">
                     <Database className="w-3 h-3 text-muted-foreground opacity-60" />
                     <span className="text-[10px] font-black text-muted-foreground uppercase">Device:</span>
                     <span className="text-[11px] font-mono font-bold text-foreground/70">{log.deviceId}</span>
                  </div>
               </div>
            </div>

            {/* Data Preview */}
            {log.data && Object.keys(log.data).length > 0 && (
              <div className="p-5 md:w-80 bg-muted/5 flex items-center">
                 <details className="w-full cursor-pointer group/data">
                    <summary className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest list-none flex items-center gap-2 group-hover/data:text-primary transition-colors">
                       <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                       View JSON Payload
                    </summary>
                    <pre className="mt-3 p-3 bg-background border rounded-xl text-[10px] font-mono text-foreground/80 overflow-x-auto shadow-inner max-h-32">
                       {JSON.stringify(log.data, null, 2)}
                    </pre>
                 </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
);
