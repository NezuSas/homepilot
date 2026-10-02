import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Clock, Zap, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { mapActivityType } from '../lib/i18n-mapping-utils';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditLogsSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { humanize } from '../lib/naming-utils';
import { EventFilters, EMPTY_EVENT_FILTERS } from '../components/EventFilters';
import { eventNames, matchesEventName, eventAction, localEventDate } from '../lib/eventFiltering';

/**
 * Registro de actividad atómico para la UI.
 */
interface ActivityRecord {
  timestamp: string;
  deviceId: string;
  type: string;
  description: string;
  data: Record<string, unknown>;
  correlationId?: string;
}

interface DisplayActivityRecord extends ActivityRecord {
  occurrences: number;
}

const REPETITIVE_SYNC_TYPES = new Set(['STATE_CHANGED', 'DEVICE_SYNC']);
const REPETITIVE_SYNC_WINDOW_MS = 10 * 60 * 1000;

/**
 * Condenses adjacent background state syncs so the technical log prioritizes
 * events an operator can act on. Individual commands, errors, and automation
 * events intentionally remain atomic.
 */
const summarizeRepetitiveSyncs = (records: ActivityRecord[]): DisplayActivityRecord[] => {
  return records.reduce<DisplayActivityRecord[]>((summaries, record) => {
    const previous = summaries.at(-1);
    const isRepetitiveSync = REPETITIVE_SYNC_TYPES.has(record.type);
    const isSameBurst = Boolean(
      previous
      && isRepetitiveSync
      && previous.type === record.type
      && previous.deviceId === record.deviceId
      && Date.parse(previous.timestamp) - Date.parse(record.timestamp) <= REPETITIVE_SYNC_WINDOW_MS
    );

    if (isSameBurst && previous) {
      previous.occurrences += 1;
      return summaries;
    }

    summaries.push({ ...record, occurrences: 1 });
    return summaries;
  }, []);
};

/**
 * AuditLogsView
 * Vista técnica para la observabilidad del sistema local.
 */
export const AuditLogsView: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSettled, setInitialSettled] = useState(false);
  const initialLoading = useInitialLoading(!initialSettled || loading);
  const [error, setError] = useState<string | null>(null);
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/api/v1/activity-logs`);
      if (!res.ok) throw new Error(t('audit_logs.fetch_error'));
      const data = await res.json() as ActivityRecord[];
      setLogs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.api_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([fetchLogs(), refreshSnapshot()]).then(() => { if (active) setInitialSettled(true); });
    return () => { active = false; };
  }, [fetchLogs, refreshSnapshot]);

  const getDeviceName = (deviceId: string): string => {
    const device = devices.find((candidate) => candidate.id === deviceId);
    return device ? humanize(device.id, device.name) : t('common.unknown');
  };

  const displayLogs = useMemo(() => summarizeRepetitiveSyncs(logs.filter(log =>
    (!filters.date || localEventDate(log.timestamp) === filters.date)
    && (filters.action === 'all' || eventAction(log.type, log.data) === filters.action)
    && matchesEventName(filters.name, logs.filter(candidate => candidate === log || (log.correlationId && candidate.correlationId === log.correlationId))
      .flatMap(candidate => eventNames({ ...candidate, data: candidate.data }, devices))))), [logs, filters, devices]);

  if (initialLoading) {
    return <AuditLogsSkeleton label={t('audit_logs.loading')} />;
  }

  if (error) {
    return (
      <AlertBanner
        variant="danger"
        icon={ShieldAlert}
        title={t('audit_logs.error_title')}
        message={error}
        action={
          <Button variant="danger" size="sm" onClick={fetchLogs}>
            {t('audit_logs.retry')}
          </Button>
        }
      />
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('audit_logs.empty_title')}
        description={t('audit_logs.empty_description')}
        className="min-h-glow-orb"
        action={
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2 text-micro uppercase tracking-widest">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('audit_logs.refresh')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <SectionHeader
        level="view"
        icon={ShieldAlert}
        title={t('nav.system_audit')}
        action={
          <Button variant="secondary" size="sm" onClick={fetchLogs} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('audit_logs.refresh')}
          </Button>
        }
      />

      <EventFilters value={filters} onChange={setFilters} />
      <p className="text-caption text-muted-foreground">{t('diagnostics.filters.recent_only')}</p>
      {!displayLogs.length && <p role="status" className="text-caption text-muted-foreground">{t('diagnostics.filters.no_matches')}</p>}
      <div className="grid min-w-0 gap-3">
        {displayLogs.map((log, i) => (
          <div key={`${log.timestamp}-${i}`} className="group flex flex-col md:flex-row border border-border/50 bg-card hover:border-primary/30 transition-all rounded-2xl overflow-hidden shadow-sm">
            {/* Metadata Col */}
            <div className="w-full md:w-56 p-5 bg-muted/20 border-b md:border-b-0 md:border-r border-border/30 flex flex-col justify-center gap-2">
               <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-label font-mono font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
               </div>
               <div className={cn(
                 "rounded-control border px-1.5 py-0.5 text-nano font-medium uppercase leading-none tracking-micro self-start",
                 log.type.includes('FAILED') ? "bg-danger/10 text-danger border-danger/20" : "bg-primary/5 text-primary border-primary/10"
               )}>
                 {mapActivityType(log.type, t)}
               </div>
               <span className="text-micro font-mono text-muted-foreground italic mt-1">{new Date(log.timestamp).toLocaleDateString()}</span>
            </div>

            {/* Content Col */}
            <div className="min-w-0 flex-1 p-3 flex flex-col justify-center gap-3">
               <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 shrink-0 text-primary opacity-40" />
                  <p className="min-w-0 break-words text-body font-bold tracking-tight text-foreground/90">
                    {log.occurrences > 1
                      ? t('audit_logs.messages.REPETITIVE_SYNC_SUMMARY', {
                        count: log.occurrences,
                        deviceName: getDeviceName(log.deviceId),
                      })
                      : (() => {
                      let key = `audit_logs.messages.${log.type}`;
                      // 1. Parsing robusto de datos (maneja strings, objetos o nulos)
                      const dataRaw = log.data || {};
                      let data: Record<string, unknown> = {};
                      try {
                        const parsedData: unknown = typeof dataRaw === 'string' ? JSON.parse(dataRaw) : dataRaw;
                        data = typeof parsedData === 'object' && parsedData !== null
                          ? parsedData as Record<string, unknown>
                          : {};
                      } catch {
                        data = {};
                      }
                      
                      // 2. Selección inteligente de clave (Refinamiento de tipos genéricos)
                      if (log.type === 'HA_RESILIENCE' && data.source) {
                        const source = data.source as string;
                        if (source === 'reconciliation') key = 'audit_logs.messages.RECONCILIATION_DONE';
                        else if (source === 'reconnect') key = 'audit_logs.messages.WS_CONNECTED';
                        else if (source === 'auth_error') key = 'audit_logs.messages.AUTH_FAILED';
                      } else if (log.type === 'COMMAND_DISPATCHED' && (data.name || data.sceneName)) {
                        key = 'audit_logs.messages.SCENE_DISPATCHED_PERSISTENT';
                      } else if (log.type.startsWith('USER_')) {
                        key = `audit_logs.messages.${log.type}`;
                      }
                      
                      // 3. Mapeo explícito de variables (Puente entre versiones de esquema)
                      // i18next v26+ es estricto; forzamos las variables al primer nivel del objeto de opciones.
                      const options = {
                        ...data,
                        // Scenes & Commands
                        sceneName: data.sceneName || data.name || t('common.unknown_scene'),
                        name: data.name || data.sceneName || t('common.unknown'),
                        userName: data.userName || data.user || t('common.system'),
                        user: data.user || data.userName || t('common.system'),
                        successCount: data.successCount !== undefined ? data.successCount : 
                                     (data.success !== undefined ? data.success : 
                                     (data.totalActions !== undefined ? (Number(data.totalActions) - Number(data.failedActions || 0)) : '0')),
                        totalCount: data.totalCount !== undefined ? data.totalCount : 
                                   (data.total !== undefined ? data.total : 
                                   (data.totalActions !== undefined ? data.totalActions : '0')),
                        total: data.total !== undefined ? data.total : (data.totalCount !== undefined ? data.totalCount : (data.totalActions || '0')),
                        success: data.success !== undefined ? data.success : (data.successCount !== undefined ? data.successCount : '0'),
                        command: data.command || t('common.unknown'),
                        // Automations
                        ruleName: data.ruleName || data.name || t('common.unknown'),
                        ruleId: data.ruleId || '',
                        deviceName: data.deviceName || t('common.unknown'),
                        // Device State
                        state: data.state !== undefined ? String(data.state) : (data.new_state !== undefined ? String(data.new_state) : t('common.unknown')),
                        new_state: data.new_state !== undefined ? String(data.new_state) : (data.state !== undefined ? String(data.state) : t('common.unknown')),
                        // Users
                        targetUser: data.targetUser || data.username || t('common.unknown'),
                        role: data.role || data.newRole || '',
                        // Utils
                        reason: data.reason || t('common.errors.unknown'),
                        defaultValue: log.description,
                        interpolation: { escapeValue: false }
                      };
                      
                        return t(key, options);
                      })()}
                  </p>
               </div>
               <div className="flex flex-wrap items-center gap-4">
                  {log.occurrences > 1 && (
                    <span className="text-micro font-bold text-muted-foreground">
                      {t('audit_logs.sync_summary_count', { count: log.occurrences })}
                    </span>
                  )}
                  {log.deviceId && (
                    <div className="flex min-w-0 flex-col gap-1 px-3 py-2 bg-muted/40 rounded-xl border border-border/40">
                       <span className="break-words text-label font-medium text-foreground/80">{getDeviceName(log.deviceId)}</span>
                       <span className="break-all text-micro font-mono text-muted-foreground">{log.deviceId}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Data Preview */}
            {log.data && Object.keys(log.data).length > 0 && (
              <div className="min-w-0 p-3 md:w-64 md:shrink-0 bg-muted/5 flex items-center">
                 <details className="min-w-0 w-full cursor-pointer group/data">
                    <summary className="text-micro font-black text-muted-foreground/60 uppercase tracking-widest list-none flex items-center gap-2 group-hover/data:text-primary transition-colors">
                       <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                       {t('audit_logs.payload_button')}
                    </summary>
                    <pre className="mt-3 w-full max-w-full resize-none p-3 bg-background border rounded-xl text-micro font-mono text-foreground/80 overflow-auto max-h-32">
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
