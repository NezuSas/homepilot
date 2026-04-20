import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Server, Zap, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Cpu, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';

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
  systemTime: string;
  systemTimeLocal: string;
  systemTimezone: string;
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

const TIMEZONE_VALUES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Caracas',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC'
];

export function DiagnosticsView() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [scenes, setScenes] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [updatingTz, setUpdatingTz] = useState(false);
  
  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);

  const user = JSON.parse(localStorage.getItem('hp_user_ctx') || '{}');
  const isAdmin = user.role === 'admin';

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
      const [snapshotRes, eventsRes, scenesRes, automationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/system/diagnostics`),
        fetch(`${API_BASE_URL}/api/v1/system/diagnostics/events`),
        fetch(`${API_BASE_URL}/api/v1/scenes`),
        fetch(`${API_BASE_URL}/api/v1/automations`)
      ]);

      if (!snapshotRes.ok || !eventsRes.ok) throw new Error(t('common.errors.api_failed'));

      setSnapshot(await snapshotRes.json());
      setEvents(await eventsRes.json());
      if (scenesRes.ok) setScenes(await scenesRes.json());
      if (automationsRes.ok) setAutomations(await automationsRes.json());
      await refreshSnapshot();
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimezoneChange = async (newTz: string) => {
    setUpdatingTz(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system/timezone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hp_session_token')}`
        },
        body: JSON.stringify({ timezone: newTz })
      });

      if (!res.ok) throw new Error(t('diagnostics.update_failed'));
      
      await fetchDiagnostics();
    } catch (err: any) {
      console.error('Timezone update failed:', err);
    } finally {
      setUpdatingTz(false);
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
        <p className="text-sm font-medium">{t('diagnostics.loading')}</p>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-start gap-4">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold text-sm">{t('diagnostics.error_loading')}</h3>
          <p className="text-xs opacity-80 mt-1">{error || t('common.errors.unknown')}</p>
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

  const StatusBadge = ({ status, label }: { status: string, label?: string }) => (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border", getStatusColor(status))}>
      {label || status.replace('_', ' ')}
    </span>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">

      {/* LOCAL RESILIENCE SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
         {[
           {
             label: t('diagnostics.metrics.native_local'),
             value: devices.filter(d => d.integrationSource === 'sonoff').length,
             sub: `${devices.filter(d => d.integrationSource === 'sonoff' && (Date.now() - new Date(d.updatedAt || 0).getTime() < 300000)).length} ${t('diagnostics.metrics.online')}`,
             icon: Cpu,
             color: 'text-success'
           },
           {
             label: t('diagnostics.metrics.bridged'),
             value: devices.filter(d => d.integrationSource !== 'sonoff').length,
             sub: t('diagnostics.metrics.external_mesh'),
             icon: Server,
             color: 'text-primary'
           },
           {
             label: t('diagnostics.metrics.autonomous'),
             value: scenes.filter(s => {
               const actions = s.actions || [];
               return actions.length > 0 && actions.every((a: any) => devices.find(d => d.id === a.deviceId)?.integrationSource === 'sonoff');
             }).length,
             sub: t('diagnostics.metrics.edge_executable'),
             icon: Zap,
             color: 'text-warning'
           },
           {
             label: t('diagnostics.metrics.hardware_autonomy'),
             value: automations.filter(rule => {
                const triggerDevice = devices.find(d => d.id === rule.trigger?.deviceId);
                const actionDevice = devices.find(d => d.id === rule.action?.targetDeviceId);
                const targetScene = scenes.find(s => s.id === rule.action?.sceneId);
                const isLocal = (d?: any) => d?.integrationSource === 'sonoff';
                
                const triggerIsLocal = rule.trigger?.type === 'time' || isLocal(triggerDevice);
                let actionIsLocal = false;
                if (rule.action?.type === 'device_command') {
                  actionIsLocal = isLocal(actionDevice);
                } else if (rule.action?.type === 'execute_scene' && targetScene?.actions) {
                  actionIsLocal = targetScene.actions.every((a: any) => isLocal(devices.find(d => d.id === a.deviceId)));
                }
                return triggerIsLocal && actionIsLocal;
             }).length,
             sub: t('diagnostics.metrics.zero_cloud'),
             icon: ShieldCheck,
             color: 'text-success'
           }
         ].map((stat, i) => (
           <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/40 transition-all shadow-sm">
              <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">{stat.label}</p>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tabular-nums">{stat.value}</span>
                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">{stat.sub}</span>
                 </div>
              </div>
              <div className={cn("p-3 rounded-xl bg-muted/50 group-hover:scale-110 transition-transform", stat.color)}>
                 <stat.icon className="w-5 h-5" />
              </div>
           </div>
         ))}
      </div>
      
      {/* OVERALL HEALTH BANNER */}
      <div className={cn(
        "border-2 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6",
        snapshot.overallStatus === 'healthy' ? 'border-success/50 bg-success/5' :
        snapshot.overallStatus === 'degraded' ? 'border-warning/50 bg-warning/5' :
        'border-danger/50 bg-danger/5'
      )}>
        <div className="flex items-center gap-4">
          {snapshot.overallStatus === 'healthy' ? <CheckCircle2 className="w-10 h-10 text-success" /> :
           snapshot.overallStatus === 'degraded' ? <AlertTriangle className="w-10 h-10 text-warning" /> :
           <XCircle className="w-10 h-10 text-danger" />}
          <div>
            <h2 className="text-2xl font-bold tracking-tight capitalize">{t('diagnostics.system_status', { status: t(`diagnostics.status.${snapshot.overallStatus}`) })}</h2>
            <p className="text-sm text-foreground/60 mt-1">
              {snapshot.overallStatus === 'healthy' 
                ? t('diagnostics.messages.healthy')
                : snapshot.issues.length ? t('diagnostics.messages.degraded') : t('diagnostics.messages.offline')}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
          {/* APPLIANCE TIME */}
          <div className="sm:text-right">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">{t('diagnostics.appliance_time')}</div>
            <div className="flex flex-col items-end gap-1 mt-1">
              <div className="font-mono font-bold text-sm">
                {snapshot.systemTimeLocal}
              </div>
              
              {isAdmin && (
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-tighter">{t('diagnostics.timezone')}</span>
                   <select 
                     className="bg-background/50 border border-border/50 rounded px-2 py-0.5 text-[10px] font-bold outline-none focus:border-primary transition-colors cursor-pointer"
                     value={snapshot.systemTimezone}
                     disabled={updatingTz}
                     onChange={(e) => handleTimezoneChange(e.target.value)}
                   >
                     {TIMEZONE_VALUES.map(tz => (
                       <option key={tz} value={tz}>{t(`timezones.${tz}`)}</option>
                     ))}
                   </select>
                   {updatingTz && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
                </div>
              )}
            </div>
          </div>

          {/* LAST EVENT */}
          <div className="sm:text-right">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">{t('diagnostics.last_event')}</div>
            <div className="font-mono font-bold mt-1 text-sm">{formatTime(snapshot.lastEventAt)}</div>
          </div>
        </div>
      </div>

      {/* ISSUES ALERT (only if there are issues) */}
      {snapshot.issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground opacity-50">{t('diagnostics.active_issues')}</h3>
          {snapshot.issues.map((issue, idx) => (
            <div key={idx} className={cn(
              "flex items-start gap-4 p-4 rounded-xl border",
              issue.severity === 'critical' ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-warning/50 bg-warning/5 text-warning"
            )}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="uppercase font-mono text-[11px] tracking-widest font-bold">{t(`diagnostics.issues.${issue.code}`, { defaultValue: issue.code }) as string}</span>
                <span className="text-sm">{t(issue.message as string)}</span>
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
              <Server className="w-4 h-4 text-primary" /> {t('ha_settings.title')}
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
              <span className="font-mono font-bold text-warning">{snapshot.counters.recentReconnects}</span>
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
              <Zap className="w-4 h-4 text-primary" /> {t('dashboard.logic_engine')}
            </h4>
            <StatusBadge status={snapshot.automationEngineStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-[10px] uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.activity_volume')}</span>
              <div className="text-xs font-mono font-bold flex items-center gap-2">
                <span className="text-success">+{snapshot.counters.recentAutomationSuccess}</span> 
                <span className="text-muted-foreground/30">/</span> 
                <span className="text-danger">-{snapshot.counters.recentAutomationFailures}</span>
              </div>
            </div>
            <div className="flex justify-between text-[11px] border-t border-border/50 pt-3">
              <span className="font-bold text-muted-foreground/70">{t('diagnostics.probes.eval_failed')}</span>
              <span className="font-mono font-bold text-danger">{snapshot.counters.recentAutomationFailures}</span>
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
              <RefreshCw className="w-4 h-4 text-primary" /> {t('diagnostics.probes.state_delta')}
            </h4>
            <StatusBadge status={snapshot.reconciliationStatus} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end pb-3">
              <span className="text-[10px] uppercase font-black text-muted-foreground opacity-40">{t('diagnostics.probes.state_delta')}</span>
              <div className="text-xs font-mono font-bold">
                 {snapshot.counters.recentReconciliations} {t('diagnostics.probes.cycles')}
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
        <h3 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground opacity-50">{t('diagnostics.timeline')}</h3>
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
                    <div key={group.id} className={cn("p-5 flex flex-col gap-4 hover:bg-muted/50 transition-colors", isError ? "bg-danger/5 hover:bg-danger/10" : "")}>
                      <div 
                        className="flex gap-4 cursor-pointer" 
                        onClick={() => toggleExpand(group.id)}
                      >
                        <div className="w-24 shrink-0 text-[10px] text-muted-foreground font-mono font-bold mt-1">
                          {new Date(ev.occurredAt).toLocaleTimeString()}
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest", isError ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary")}>
                              {ev.category}
                            </span>
                            <span className={cn("font-bold text-sm tracking-tight", isError ? "text-danger" : "")}>{ev.eventType}</span>
                            {(hasChildren || hasData) && (
                              <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 border rounded-full">
                                {isExpanded ? t('diagnostics.hide_details') : t('diagnostics.view_details')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground/70">{t(ev.description as string)}</p>
                        </div>
                      </div>
                      
                      {isExpanded && (hasData || hasChildren) && (
                        <div className="ml-28 pl-4 border-l-2 border-border/50 flex flex-col gap-4 mt-2">
                          {hasData && (
                            <div className="text-[10px] font-mono text-muted-foreground/80 leading-relaxed bg-black/5 dark:bg-black/20 p-3 rounded-lg overflow-x-auto">
                              <span className="font-bold uppercase tracking-widest opacity-60 mb-2 block">{t('diagnostics.payload')}</span>
                              {Object.entries(ev.data).map(([key, val]) => (
                                <div key={key}><span className="opacity-50">{key}:</span> {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                              ))}
                            </div>
                          )}

                          {hasChildren && (
                            <div className="flex flex-col gap-3 mt-2">
                              <span className="font-bold text-[10px] uppercase tracking-widest opacity-60">{t('diagnostics.trace_events')}</span>
                              {group.children.map((child, cIdx) => (
                                <div key={cIdx} className="flex gap-4 items-start text-xs text-muted-foreground bg-card border rounded p-3">
                                  <div className="w-20 shrink-0 font-mono opacity-60">
                                    {new Date(child.occurredAt).toLocaleTimeString()}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="font-bold flex items-center gap-2">
                                      <span className={child.eventType.includes('FAILED') ? 'text-danger' : 'text-foreground'}>{child.eventType}</span>
                                    </div>
                                    <div className="opacity-80">{t(child.description as string)}</div>
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
