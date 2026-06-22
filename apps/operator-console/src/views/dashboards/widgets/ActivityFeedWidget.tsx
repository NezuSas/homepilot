import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';
import { Activity, Clock, Shield, Cpu, Zap } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';

const API = `${API_BASE_URL}/api/v1`;

interface SystemEvent {
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

export function ActivityFeedWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/system/diagnostics/events`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEvents(data.slice(0, 10)); // Top 10
        }
      }
    } catch (err) {
      console.error('Failed to fetch activity feed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const getEventIcon = (type: string) => {
    if (type.includes('Auth')) return <Shield className="h-3 w-3 text-primary" />;
    if (type.includes('Device')) return <Zap className="w-3 h-3 text-amber-400" />;
    if (type.includes('Room')) return <Activity className="w-3 h-3 text-success" />;
    return <Cpu className="w-3 h-3 text-muted-foreground/60" />;
  };

  const formatEventName = (type: string) => {
    return type.replace('Event', '').replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div className={cn(
      "flex flex-col h-full rounded-3xl p-5 overflow-hidden transition-all duration-500",
      config.appearance.variant === 'glass' ? "bg-card/40 backdrop-blur-md border border-border/40" : "bg-card border border-border"
    )}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-foreground tracking-tight">
            {config.appearance.title || t('dashboards.widgets.activity_feed.label')}
          </h3>
        </div>
        {!loading && (
          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{t('shell.status.live')}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-full bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <DormantWidgetPlaceholder
            title={t('dashboards.widgets.activity_feed.label')}
            icon={Activity}
            message={t('dashboards.widgets.activity_feed.placeholder')}
            isEditing={isEditing}
            onConfigure={onConfigure}
            variant={config.appearance.variant}
          />
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="flex items-start gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="p-1.5 rounded-lg bg-muted/50 border border-border/40 shrink-0 mt-0.5">
                {getEventIcon(event.eventType)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-foreground leading-tight truncate">
                  {formatEventName(event.eventType)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
