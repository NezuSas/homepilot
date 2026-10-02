import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, RefreshCw, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { ExecutionRecord } from '../types/executions';
import { ExecutionCard } from '../components/ExecutionCard';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ExecutionsSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useTranslation } from 'react-i18next';
import { EventFilters, EMPTY_EVENT_FILTERS } from '../components/EventFilters';
import { eventNames, matchesEventName, localEventDate } from '../lib/eventFiltering';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';

export const ExecutionLogsView: React.FC = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS);
  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);
  const [initialSettled, setInitialSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialLoading = useInitialLoading(loading || !initialSettled);
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
    let active = true;
    void Promise.all([fetchRecords(), refreshSnapshot()]).finally(() => { if (active) setInitialSettled(true); });
    return () => { active = false; };
  }, [fetchRecords, refreshSnapshot]);

  const visibleRecords = records.filter(record => (!filters.date || localEventDate(record.startedAt) === filters.date)
    && (filters.action === 'all' || (record.sourceType === 'manual' ? 'command' : record.sourceType) === filters.action)
    && matchesEventName(filters.name, eventNames(record.actions, devices)));

  if (initialLoading) {
    return <ExecutionsSkeleton label={t('execution_logs.loading')} />;
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
    <div className="flex flex-col gap-6 sm:gap-8">
      <SectionHeader
        level="view"
        icon={Activity}
        title={t('nav.system_executions')}
        action={
          <Button variant="secondary" size="sm" onClick={fetchRecords} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('execution_logs.sync_now')}
          </Button>
        }
      />

      <EventFilters value={filters} onChange={setFilters} />
      <p className="text-caption text-muted-foreground">{t('diagnostics.filters.recent_only')}</p>
      <div className="grid min-w-0 gap-3">
        {visibleRecords.length === 0 && <p className="py-4 text-caption text-muted-foreground">{t('diagnostics.filters.no_matches')}</p>}
        {visibleRecords.map((record) => (
          <ExecutionCard 
            key={record.id} 
            record={record} 
            onRetrySuccess={fetchRecords}
          />
        ))}
      </div>
      
      <div className="flex flex-col items-center gap-3 border-t border-border/50 py-8 text-muted-foreground">
         <Activity className="w-8 h-8" />
         <p className="text-caption font-medium">{t('execution_logs.end_of_records')}</p>
      </div>
    </div>
  );
};
