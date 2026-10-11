import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { Heading } from '../../../components/ui/Heading';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusPill } from '../../../components/ui/StatusPill';
import type { DashboardWidgetConfig } from '../types';
import { Activity, Clock, Shield, Cpu, Zap } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { fetchDiagnosticResource, startSequentialPolling } from '../../../lib/diagnosticResourceRequests';

const API = `${API_BASE_URL}/api/v1`;

type SystemEventCategory = 'command' | 'resilience' | 'automation';

interface SystemEvent {
  occurredAt: string;
  category: SystemEventCategory;
  eventType: string;
  description: string;
}

import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

export function ActivityFeedWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return startSequentialPolling(async (signal) => {
      try {
        const res = await fetchDiagnosticResource(`${API}/system/diagnostics/events`, signal);
        if (res.ok) {
          const data: unknown = await res.json();
          if (!signal.aborted && Array.isArray(data)) setEvents(data.slice(0, 10));
        }
      } catch {
        // Preserve the last activity feed while the next poll retries.
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, 30_000);
  }, []);

  const getEventIcon = (category: SystemEventCategory, eventType: string) => {
    if (eventType === 'AUTH_FAILED') return <Shield className="h-3 w-3 text-danger" />;
    if (category === 'automation') return <Zap className="w-3 h-3 text-warning" />;
    if (category === 'resilience') return <Activity className="w-3 h-3 text-success" />;
    return <Cpu className="w-3 h-3 text-muted-foreground/60" />;
  };

  // Known event codes get a calm, translated label; anything new the backend
  // introduces still shows something readable instead of a blank string.
  const formatEventName = (eventType: string) => {
    const translated = t(`dashboards.widgets.activity_feed.events.${eventType}`, { defaultValue: '' });
    if (translated) return translated;
    return eventType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  };

  return (
    <Card
      variant={config.appearance.variant === 'glass' ? 'glass' : 'flat'}
      className="flex flex-col h-full min-h-0 p-4 @md:p-5 transition-all duration-500"
    >
      <div className="flex items-center justify-between gap-2 mb-3 @md:mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <StatusPill variant="primary" className="p-2">
            <Activity className="w-4 h-4" />
          </StatusPill>
          <Heading as="h3" variant="card" className="truncate">
            {config.appearance.title || t('dashboards.widgets.activity_feed.label')}
          </Heading>
        </div>
        {!loading && (
          <span className="hp-type-label text-muted-foreground/50">{t('shell.status.live')}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 @md:space-y-3">
        {loading ? (
          <LoadingState label={t('common.loading')} className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-full rounded-xl bg-muted/40" />
            ))}
          </LoadingState>
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
                {getEventIcon(event.category, event.eventType)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-label font-bold text-foreground leading-tight truncate">
                  {formatEventName(event.eventType)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-micro font-medium text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
