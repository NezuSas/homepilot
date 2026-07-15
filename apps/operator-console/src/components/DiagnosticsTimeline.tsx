import React from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface DiagnosticEvent {
  occurredAt: string;
  category: 'resilience' | 'automation' | 'auth' | 'command';
  eventType: string;
  description: string;
  data: unknown;
  correlationId?: string;
}

interface DiagnosticsTimelineProps {
  events: DiagnosticEvent[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

type EventGroup = {
  id: string;
  main: DiagnosticEvent;
  children: DiagnosticEvent[];
};

type EventData = Record<string, string | number | boolean | null | undefined | object>;

const normalizeEventData = (rawData: unknown): EventData => {
  try {
    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as EventData;
    }
  } catch {
    return {};
  }

  return {};
};

const getInterpolatedMessageData = (data: EventData, fallback: string, t: ReturnType<typeof useTranslation>['t']) => ({
  ...data,
  sceneName: data.sceneName || data.name || t('common.unknown_scene'),
  name: data.name || data.sceneName || t('common.unknown'),
  userName: data.userName || data.user || t('common.system'),
  user: data.user || data.userName || t('common.system'),
  successCount: data.successCount !== undefined
    ? data.successCount
    : data.success !== undefined
      ? data.success
      : data.totalActions !== undefined
        ? Number(data.totalActions) - Number(data.failedActions || 0)
        : '0',
  totalCount: data.totalCount !== undefined
    ? data.totalCount
    : data.total !== undefined
      ? data.total
      : data.totalActions !== undefined
        ? data.totalActions
        : '0',
  total: data.total !== undefined ? data.total : (data.totalCount !== undefined ? data.totalCount : (data.totalActions || '0')),
  success: data.success !== undefined ? data.success : (data.successCount !== undefined ? data.successCount : '0'),
  command: data.command || t('common.unknown'),
  ruleName: data.ruleName || data.name || t('common.unknown'),
  ruleId: data.ruleId || '',
  deviceName: data.deviceName || t('common.unknown'),
  state: data.state !== undefined ? String(data.state) : (data.new_state !== undefined ? String(data.new_state) : t('common.unknown')),
  new_state: data.new_state !== undefined ? String(data.new_state) : (data.state !== undefined ? String(data.state) : t('common.unknown')),
  targetUser: data.targetUser || data.username || t('common.unknown'),
  role: data.role || data.newRole || '',
  reason: data.reason || t('common.errors.unknown'),
  defaultValue: fallback,
  interpolation: { escapeValue: false }
});

const getMainEventMessage = (event: DiagnosticEvent, t: ReturnType<typeof useTranslation>['t']) => {
  const data = normalizeEventData(event.data);
  const key = event.eventType === 'COMMAND_DISPATCHED' && (data.name || data.sceneName)
    ? 'audit_logs.messages.SCENE_DISPATCHED_PERSISTENT'
    : `audit_logs.messages.${event.eventType}`;

  return t(key, getInterpolatedMessageData(data, event.description, t));
};

const getChildEventMessage = (event: DiagnosticEvent, t: ReturnType<typeof useTranslation>['t']) => {
  const data = normalizeEventData(event.data);
  return t(`audit_logs.messages.${event.eventType}`, getInterpolatedMessageData(data, event.description, t));
};

const groupEvents = (events: DiagnosticEvent[]): EventGroup[] => {
  const groupedEvents: EventGroup[] = [];
  const correlationMap = new Map<string, EventGroup>();

  events.forEach((event, index) => {
    if (!event.correlationId) {
      groupedEvents.push({ id: `standalone-${index}`, main: event, children: [] });
      return;
    }

    const existingGroup = correlationMap.get(event.correlationId);
    if (existingGroup) {
      existingGroup.children.push(event);
      return;
    }

    const newGroup = { id: event.correlationId, main: event, children: [] };
    correlationMap.set(event.correlationId, newGroup);
    groupedEvents.push(newGroup);
  });

  return groupedEvents;
};

const isErrorEvent = (eventType: string) => eventType.includes('failed') || eventType.includes('FAILED') || eventType.includes('error');

export const DiagnosticsTimeline: React.FC<DiagnosticsTimelineProps> = ({ events, expandedIds, onToggleExpand }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-micro font-black tracking-widest uppercase text-muted-foreground opacity-50">{t('diagnostics.timeline')}</h3>
      <div className="border border-border bg-card rounded-2xl overflow-hidden">
        <div className="divide-y divide-border/50 max-h-timeline overflow-y-auto custom-scrollbar">
          {events.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center opacity-40">
              <Activity className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="text-micro font-black uppercase tracking-widest">{t('diagnostics.no_events')}</p>
            </div>
          ) : (
            groupEvents(Array.isArray(events) ? events : []).map(group => {
              const event = group.main;
              const isExpanded = expandedIds.has(group.id);
              const hasChildren = group.children.length > 0;
              const data = normalizeEventData(event.data);
              const hasData = Object.keys(data).length > 0;
              const isError = isErrorEvent(event.eventType);

              return (
                <div key={group.id} className={cn("p-5 flex flex-col gap-4 hover:bg-muted/50 transition-colors", isError ? "bg-danger/5 hover:bg-danger/10" : "")}>
                  <div
                    className="flex gap-4 cursor-pointer"
                    onClick={() => onToggleExpand(group.id)}
                  >
                    <div className="w-24 shrink-0 text-micro text-muted-foreground font-mono font-bold mt-1">
                      {new Date(event.occurredAt).toLocaleTimeString()}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-micro font-black uppercase tracking-widest", isError ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary")}>
                          {t(`diagnostics.categories.${event.category}`, { defaultValue: event.category })}
                        </span>
                        <span className={cn("font-bold text-body tracking-tight", isError ? "text-danger" : "")}>
                          {t(`common.events.${event.eventType}`, { defaultValue: event.eventType })}
                        </span>
                        {(hasChildren || hasData) && (
                          <span className="text-micro uppercase font-bold text-muted-foreground px-2 py-0.5 border rounded-full">
                            {isExpanded ? t('diagnostics.hide_details') : t('diagnostics.view_details')}
                          </span>
                        )}
                      </div>
                      <p className="text-body font-medium text-foreground/70">{getMainEventMessage(event, t)}</p>
                    </div>
                  </div>

                  {isExpanded && (hasData || hasChildren) && (
                    <div className="ml-28 pl-4 border-l-2 border-border/50 flex flex-col gap-4 mt-2">
                      {hasData && (
                        <div className="text-micro font-mono text-muted-foreground/80 leading-relaxed bg-black/5 dark:bg-black/20 p-3 rounded-lg overflow-x-auto">
                          <span className="font-bold uppercase tracking-widest opacity-60 mb-2 block">{t('diagnostics.payload')}</span>
                          {Object.entries(data).map(([key, value]) => (
                            <div key={key}><span className="opacity-50">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>
                          ))}
                        </div>
                      )}

                      {hasChildren && (
                        <div className="flex flex-col gap-3 mt-2">
                          <span className="font-bold text-micro uppercase tracking-widest opacity-60">{t('diagnostics.trace_events')}</span>
                          {group.children.map((child, childIndex) => (
                            <div key={`${child.eventType}-${childIndex}`} className="flex gap-4 items-start text-caption text-muted-foreground bg-card border rounded p-3">
                              <div className="w-20 shrink-0 font-mono opacity-60">
                                {new Date(child.occurredAt).toLocaleTimeString()}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="font-bold flex items-center gap-2">
                                  <span className={child.eventType.includes('FAILED') ? 'text-danger' : 'text-foreground'}>
                                    {t(`common.events.${child.eventType}`, { defaultValue: child.eventType })}
                                  </span>
                                </div>
                                <div className="opacity-80">{getChildEventMessage(child, t)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
