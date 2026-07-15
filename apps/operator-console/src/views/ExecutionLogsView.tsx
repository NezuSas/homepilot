import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldAlert, RefreshCw, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { ExecutionRecord } from '../types/executions';
import { ExecutionCard } from '../components/ExecutionCard';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

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
      <div className="flex flex-col items-center justify-center min-h-empty-sm animate-pulse">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary/40" />
        <p className="text-body font-black uppercase tracking-label-wider opacity-30 italic">Syncing with Edge...</p>
      </div>
    );
  }

  if (error) {
    return (
      <AlertBanner
        variant="danger"
        icon={ShieldAlert}
        title="Observability Error"
        message={error}
        action={
          <Button variant="danger" size="sm" onClick={fetchRecords}>
            Retry Connection
          </Button>
        }
      />
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No Executions Detected"
        description="There is no historical data for scenes or automations yet. Execute a scene to see it here."
        className="min-h-glow-orb"
        action={
          <Button variant="outline" size="sm" onClick={fetchRecords} className="gap-2 text-micro uppercase tracking-widest">
            <RefreshCw className="h-3.5 w-3.5" />
            Scan Edge Logs
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex items-center justify-between px-4">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-micro font-black text-muted-foreground uppercase tracking-label-wider">
              Edge Real-time Observability
            </span>
         </div>
         <button 
            onClick={fetchRecords} 
            className="group flex items-center gap-2 text-micro font-black text-muted-foreground hover:text-primary transition-colors"
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
         <p className="text-micro font-black uppercase tracking-label-hero">End of Records</p>
      </div>
    </div>
  );
};
