import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldAlert, RefreshCw, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { ExecutionRecord } from '../types/executions';
import { ExecutionCard } from '../components/ExecutionCard';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

export const ExecutionLogsView: React.FC = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/api/v1/executions/recent?limit=50`);
      if (!res.ok) throw new Error(t('execution_logs.fetch_error'));
      const data = await res.json() as ExecutionRecord[];
      setRecords(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.api_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-empty-sm animate-pulse">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary/40" />
        <p className="text-caption font-black uppercase tracking-label opacity-40 italic">{t('execution_logs.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <AlertBanner
        variant="danger"
        icon={ShieldAlert}
        title={t('execution_logs.error_title')}
        message={error}
        action={
          <Button variant="danger" size="sm" onClick={fetchRecords}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('execution_logs.empty_title')}
        description={t('execution_logs.empty_description')}
        className="min-h-glow-orb"
        action={
          <Button variant="outline" size="sm" onClick={fetchRecords} className="gap-2 text-micro uppercase tracking-widest">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('execution_logs.scan_logs')}
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
              {t('execution_logs.realtime_observability')}
            </span>
         </div>
         <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecords} 
            className="group h-auto min-h-0 px-0 py-0 text-micro font-black text-muted-foreground hover:text-primary"
         >
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-700" />
            {t('execution_logs.sync_now')}
         </Button>
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
         <p className="text-label font-black uppercase tracking-label">{t('execution_logs.end_of_records')}</p>
      </div>
    </div>
  );
};
