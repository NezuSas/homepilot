import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldAlert, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { ExecutionRecord } from '../types/executions';
import { ExecutionCard } from '../components/ExecutionCard';

export const ExecutionLogsView: React.FC = () => {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/api/v1/executions/recent?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch execution records');
      const data = await res.json() as ExecutionRecord[];
      setRecords(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'API call failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary/40" />
        <p className="text-sm font-black uppercase tracking-[0.3em] opacity-30 italic">Syncing with Edge...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-[3rem] text-center max-w-2xl mx-auto mt-10">
        <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-6 opacity-80" />
        <h3 className="text-xl font-black text-destructive/80 mb-2">Observability Error</h3>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{error}</p>
        <button 
           onClick={fetchRecords}
           className="px-8 py-3 bg-destructive text-destructive-foreground rounded-2xl text-xs font-black hover:scale-105 transition-transform shadow-xl shadow-destructive/20"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] border-2 border-dashed border-border/40 rounded-[4rem] bg-card/10 p-12 text-center group">
        <div className="relative mb-10">
           <div className="absolute -inset-6 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
           <ShieldAlert className="relative w-20 h-20 text-muted-foreground/20 group-hover:rotate-12 transition-transform" />
        </div>
        <h3 className="text-2xl font-black text-foreground/80 mb-4 tracking-tighter">No Executions Detected</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-10 leading-relaxed font-medium">
          There is no historical data for scenes or automations yet. Execute a scene to see it here.
        </p>
        <button 
          onClick={fetchRecords}
          className="flex items-center gap-2 px-6 py-3 bg-card border border-border/60 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Scan Edge Logs
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex items-center justify-between px-4">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              Edge Real-time Observability
            </span>
         </div>
         <button 
            onClick={fetchRecords} 
            className="group flex items-center gap-2 text-[10px] font-black text-muted-foreground hover:text-primary transition-colors"
         >
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-700" />
            Sync Now
         </button>
      </div>

      <div className="grid gap-4">
        {records.map((record) => (
          <ExecutionCard 
            key={record.id} 
            record={record} 
            onRetrySuccess={fetchRecords}
          />
        ))}
      </div>
      
      <div className="py-10 flex flex-col items-center gap-4 opacity-20">
         <Activity className="w-8 h-8" />
         <p className="text-[9px] font-black uppercase tracking-[0.4em]">End of Records</p>
      </div>
    </div>
  );
};
