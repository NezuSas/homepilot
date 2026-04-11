import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Server, Zap, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';

interface DiagnosticsCounters {
  recentReconnects: number;
  recentAutomationSuccess: number;
  recentAutomationFailures: number;
  recentReconciliations: number;
}

interface SystemIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
}

interface DiagnosticsSnapshot {
  overallStatus: 'healthy' | 'degraded' | 'offline';
  haConnectionStatus: string;
  websocketStatus: string;
  automationEngineStatus: string;
  reconciliationStatus: string;
  lastEventAt: string | null;
  lastReconnectAt: string | null;
  lastReconciliationAt: string | null;
  lastAutomationExecutionAt: string | null;
  counters: DiagnosticsCounters;
  issues: SystemIssue[];
}

interface DiagnosticEvent {
  occurredAt: string;
  category: 'resilience' | 'automation' | 'auth' | 'command';
  eventType: string;
  description: string;
  data: Record<string, any>;
  correlationId?: string;
}

export function DiagnosticsView() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchDiagnostics = async () => {
    try {
      const [snapshotRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/system/diagnostics`),
        fetch(`${API_BASE_URL}/api/v1/system/diagnostics/events`)
      ]);

      if (!snapshotRes.ok || !eventsRes.ok) throw new Error('API Request failed');

      setSnapshot(await snapshotRes.json());
      setEvents(await eventsRes.json());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">{t('diagnostics.loading', { defaultValue: 'Gathering diagnostics heartbeat...' })}</p>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-start gap-4">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold text-sm">{t('diagnostics.error_loading')}</h3>
          <p className="text-xs opacity-80 mt-1">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  // --- Helpers ---
  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString() : t('common.never');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'reachable':
      case 'connected':
      case 'active':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'degraded':
      case 'reconnecting':
      case 'running':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'offline':
      case 'unreachable':
      case 'auth_error':
      case 'error':
      case 'failed':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'idle':
      case 'stopped':
        return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default:
        return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const StatusBadge = ({ status, label }: { status: string, label?: string }) => (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border", getStatusColor(status))}>
      {label || status.replace('_', ' ')}
    </span>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* OVERALL HEALTH BANNER */}
      <div className={cn(
        "border-2 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6",
        snapshot.overallStatus === 'healthy' ? 'border-green-500/50 bg-green-500/5' :
        snapshot.overallStatus === 'degraded' ? 'border-amber-500/50 bg-amber-500/5' :
        'border-red-500/50 bg-red-500/5'
      )}>
        <div className="flex items-center gap-4">
          {snapshot.overallStatus === 'healthy' ? <CheckCircle2 className="w-10 h-10 text-green-500" /> :
           snapshot.overallStatus === 'degraded' ? <AlertTriangle className="w-10 h-10 text-amber-500" /> :
           <XCircle className="w-10 h-10 text-red-500" />}
          <div>
            <h2 className="text-2xl font-bold tracking-tight capitalize">{t('diagnostics.system_status', { status: t(`diagnostics.status.${snapshot.overallStatus}`) })}</h2>
            <p className="text-sm text-foreground/60 mt-1">
              {snapshot.overallStatus === 'healthy' 
                ? 'All core services and integrations are operational.' 
                : snapshot.issues.length ? 'Issues detected. Operator revision required.' : 'System components unreachable.'}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">{t('diagnostics.last_event')}</div>
          <div className="font-mono font-bold mt-1 text-sm">{formatTime(snapshot.lastEventAt)}</div>
        </div>
      </div>

      {/* ISSUES ALERT (only if there are issues) */}
      {snapshot.issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground opacity-50">{t('diagnostics.active_issues')}</h3>
          {snapshot.issues.map((issue, idx) => (
            <div key={idx} className={cn(
              "flex items-start gap-4 p-4 rounded-xl border",
              issue.severity === 'critical' ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-amber-500/50 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            )}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="uppercase font-mono text-[11px] tracking-widest font-bold">{issue.code}</span>
                <span className="text-sm">{issue.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CORE SUBSYSTEMS */}
      {/* CORE SUBSYSTEMS */}
      <h3 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground opacity-50 mt-8 mb-4">{t('diagnostics.probes.title')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core: HA Bridge */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" /> HA Bridge Integration
            </h4>
            <StatusBadge status={snapshot.haConnectionStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t('diagnostics.probes.ws_sync')}</span>
              <StatusBadge status={snapshot.websocketStatus} />
            </div>
            <div className="flex justify-between text-xs pt-3 border-t border-border/50">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.connections_lost')}</span>
              <span className="font-mono font-bold text-amber-500">{snapshot.counters.recentReconnects}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_reconnect')}</span>
              <span className="font-mono">{formatTime(snapshot.lastReconnectAt)}</span>
            </div>
          </div>
        </div>

        {/* Core: Automation */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Automation Engine
            </h4>
            <StatusBadge status={snapshot.automationEngineStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-[10px] uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.activity_volume')}</span>
              <div className="text-xs font-mono font-bold flex items-center gap-2">
                <span className="text-green-500">+{snapshot.counters.recentAutomationSuccess}</span> 
                <span className="text-muted-foreground/30">/</span> 
                <span className="text-red-500">-{snapshot.counters.recentAutomationFailures}</span>
              </div>
            </div>
            <div className="flex justify-between text-[11px] border-t border-border/50 pt-3">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.eval_failed')}</span>
              <span className="font-mono font-bold text-red-500">{snapshot.counters.recentAutomationFailures}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_execution')}</span>
              <span className="font-mono">{formatTime(snapshot.lastAutomationExecutionAt)}</span>
            </div>
          </div>
        </div>

        {/* Core: Resilience */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> State Reconciliation
            </h4>
            <StatusBadge status={snapshot.reconciliationStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-[10px] uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.state_delta')}</span>
              <div className="text-xs font-mono font-bold">
                 {snapshot.counters.recentReconciliations} cycles 
              </div>
            </div>
            <div className="flex justify-between text-[11px] border-t border-border/50 pt-3">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.divergences_fixed')}</span>
              <span className="font-mono font-bold">{snapshot.counters.recentReconciliations}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.last_cycle')}</span>
              <span className="font-mono">{formatTime(snapshot.lastReconciliationAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div className="space-y-4 pt-4">
        <h3 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground opacity-50">Filtered Timeline</h3>
        <div className="border border-border bg-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto custom-scrollbar">
            {events.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center opacity-40">
                <Activity className="w-8 h-8 mb-4 text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t('diagnostics.no_events')}</p>
              </div>
            ) : (
              (() => {
                const groupedEvents: { id: string, main: DiagnosticEvent, children: DiagnosticEvent[] }[] = [];
                const correlationMap = new Map<string, typeof groupedEvents[0]>();

                events.forEach((ev, i) => {
                  if (!ev.correlationId) {
                    groupedEvents.push({ id: `standalone-${i}`, main: ev, children: [] });
                  } else {
                    if (!correlationMap.has(ev.correlationId)) {
                      const newGroup = { id: ev.correlationId, main: ev, children: [] };
                      correlationMap.set(ev.correlationId, newGroup);
                      groupedEvents.push(newGroup);
                    } else {
                      correlationMap.get(ev.correlationId)!.children.push(ev);
                    }
                  }
                });

                return groupedEvents.map((group) => {
                  const ev = group.main;
                  const isExpanded = expandedIds.has(group.id);
                  const hasChildren = group.children.length > 0;
                  const hasData = Object.keys(ev.data).length > 0;
                  
                  const isError = ev.eventType.includes('failed') || ev.eventType.includes('FAILED') || ev.eventType.includes('error');
                  
                  return (
                    <div key={group.id} className={cn("p-5 flex flex-col gap-4 hover:bg-muted/50 transition-colors", isError ? "bg-red-500/5 hover:bg-red-500/10" : "")}>
                      <div 
                        className="flex gap-4 cursor-pointer" 
                        onClick={() => toggleExpand(group.id)}
                      >
                        <div className="w-24 shrink-0 text-[10px] text-muted-foreground font-mono font-bold mt-1">
                          {new Date(ev.occurredAt).toLocaleTimeString()}
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest", isError ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary")}>
                              {ev.category}
                            </span>
                            <span className={cn("font-bold text-sm tracking-tight", isError ? "text-red-500" : "")}>{ev.eventType}</span>
                            {(hasChildren || hasData) && (
                              <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 border rounded-full">
                                {isExpanded ? t('diagnostics.hide_details', 'Hide Details') : t('diagnostics.view_details', 'View Details')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground/70">{ev.description}</p>
                        </div>
                      </div>
                      
                      {isExpanded && (hasData || hasChildren) && (
                        <div className="ml-28 pl-4 border-l-2 border-border/50 flex flex-col gap-4 mt-2">
                          {hasData && (
                            <div className="text-[10px] font-mono text-muted-foreground/80 leading-relaxed bg-black/5 dark:bg-black/20 p-3 rounded-lg overflow-x-auto">
                              <span className="font-bold uppercase tracking-widest opacity-60 mb-2 block">{t('diagnostics.payload', 'Payload')}</span>
                              {Object.entries(ev.data).map(([key, val]) => (
                                <div key={key}><span className="opacity-50">{key}:</span> {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                              ))}
                            </div>
                          )}

                          {hasChildren && (
                            <div className="flex flex-col gap-3 mt-2">
                              <span className="font-bold text-[10px] uppercase tracking-widest opacity-60">{t('diagnostics.trace_events', 'Trace Events')}</span>
                              {group.children.map((child, cIdx) => (
                                <div key={cIdx} className="flex gap-4 items-start text-xs text-muted-foreground bg-card border rounded p-3">
                                  <div className="w-20 shrink-0 font-mono opacity-60">
                                    {new Date(child.occurredAt).toLocaleTimeString()}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="font-bold flex items-center gap-2">
                                      <span className={child.eventType.includes('FAILED') ? 'text-red-500' : 'text-foreground'}>{child.eventType}</span>
                                    </div>
                                    <div className="opacity-80">{child.description}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
