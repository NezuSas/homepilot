import React from 'react';
import { RefreshCw, Server, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface DiagnosticsCounters {
  recentReconnects: number;
  recentAutomationSuccess: number;
  recentAutomationFailures: number;
  recentReconciliations: number;
}

interface DiagnosticsProbeGridProps {
  haConnectionStatus: string;
  websocketStatus: string;
  automationEngineStatus: string;
  reconciliationStatus: string;
  lastReconnectAt: string | null;
  lastAutomationExecutionAt: string | null;
  lastReconciliationAt: string | null;
  counters: DiagnosticsCounters;
  formatTime: (iso: string | null) => string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy':
    case 'reachable':
    case 'connected':
    case 'active':
      return 'text-success bg-success/10 border-success/20';
    case 'degraded':
    case 'reconnecting':
    case 'running':
      return 'text-warning bg-warning/10 border-warning/20';
    case 'offline':
    case 'unreachable':
    case 'auth_error':
    case 'error':
    case 'failed':
      return 'text-danger bg-danger/10 border-danger/20';
    case 'idle':
    case 'stopped':
      return 'text-muted-foreground bg-muted/10 border-muted/20';
    default:
      return 'text-muted-foreground bg-muted/10 border-muted/20';
  }
};

const StatusBadge = ({ status, label }: { status: string; label?: string }) => (
  <span className={cn("px-2 py-0.5 rounded text-micro font-black uppercase tracking-wider border", getStatusColor(status))}>
    {label || status.replace('_', ' ')}
  </span>
);

export const DiagnosticsProbeGrid: React.FC<DiagnosticsProbeGridProps> = ({
  haConnectionStatus,
  websocketStatus,
  automationEngineStatus,
  reconciliationStatus,
  lastReconnectAt,
  lastAutomationExecutionAt,
  lastReconciliationAt,
  counters,
  formatTime
}) => {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="text-micro font-black tracking-widest uppercase text-muted-foreground opacity-50 mt-8 mb-4">{t('diagnostics.probes.title')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> {t('ha_settings.title')}
            </h4>
            <StatusBadge status={haConnectionStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold text-muted-foreground">{t('diagnostics.probes.ws_sync')}</span>
              <StatusBadge status={websocketStatus} />
            </div>
            <div className="flex justify-between text-caption pt-3 border-t border-border/50">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.connections_lost')}</span>
              <span className="font-mono font-bold text-warning">{counters.recentReconnects}</span>
            </div>
            <div className="flex justify-between text-label">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_reconnect')}</span>
              <span className="font-mono">{formatTime(lastReconnectAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> {t('dashboard.logic_engine')}
            </h4>
            <StatusBadge status={automationEngineStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-micro uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.activity_volume')}</span>
              <div className="text-caption font-mono font-bold flex items-center gap-2">
                <span className="text-success">+{counters.recentAutomationSuccess}</span>
                <span className="text-muted-foreground/30">/</span>
                <span className="text-danger">-{counters.recentAutomationFailures}</span>
              </div>
            </div>
            <div className="flex justify-between text-label border-t border-border/50 pt-3">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.eval_failed')}</span>
              <span className="font-mono font-bold text-danger">{counters.recentAutomationFailures}</span>
            </div>
            <div className="flex justify-between text-label">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_execution')}</span>
              <span className="font-mono">{formatTime(lastAutomationExecutionAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> {t('diagnostics.probes.state_delta')}
            </h4>
            <StatusBadge status={reconciliationStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-micro uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.state_delta')}</span>
              <div className="text-caption font-mono font-bold">
                {counters.recentReconciliations} {t('diagnostics.probes.cycles')}
              </div>
            </div>
            <div className="flex justify-between text-label border-t border-border/50 pt-3">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.divergences_fixed')}</span>
              <span className="font-mono font-bold">{counters.recentReconciliations}</span>
            </div>
            <div className="flex justify-between text-label">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_cycle')}</span>
              <span className="font-mono">{formatTime(lastReconciliationAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
