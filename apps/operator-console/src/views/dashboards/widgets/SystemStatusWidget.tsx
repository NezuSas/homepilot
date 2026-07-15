import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';
import { Cpu, Zap, Timer, HardDrive, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';

const API = `${API_BASE_URL}/api/v1`;

interface SystemSnapshot {
  cpuUsage: number;
  memoryUsage: {
    used: number,
    total: number,
    percentage: number
  };
  uptime: number;
  diskUsage?: {
    used: number,
    total: number,
    percentage: number
  };
}

import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

export function SystemStatusWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/system/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s for health metrics
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h ${m}m`;
  };

  const getMetricColor = (val: number) => {
    if (val > 85) return 'text-destructive';
    if (val > 60) return 'text-warning';
    return 'text-primary';
  };

  const getMetricBg = (val: number) => {
    if (val > 85) return 'bg-destructive/20';
    if (val > 60) return 'bg-warning/20';
    return 'bg-primary/20';
  };

  return (
    <div className={cn(
      "flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 overflow-hidden transition-all duration-500",
      config.appearance.variant === 'glass' ? "bg-card/40 backdrop-blur-md border border-border/40" : "bg-card border border-border"
    )}>
      <div className="flex items-center justify-between gap-2 mb-3 @md:mb-5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-caption @md:text-body font-black text-foreground tracking-tight truncate">
            {config.appearance.title || t('dashboards.widgets.system_status.label')}
          </h3>
        </div>
        {!loading && (
           <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-glow shadow-success/50" />
              <span className="text-micro font-black uppercase tracking-widest text-muted-foreground/40">{t('dashboards.widgets.system_status.online')}</span>
           </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 w-full bg-muted/40 rounded-2xl" />
            <div className="h-10 w-full bg-muted/40 rounded-2xl" />
            <div className="h-10 w-full bg-muted/40 rounded-2xl" />
          </div>
        ) : !snapshot ? (
          <DormantWidgetPlaceholder
            title={t('dashboards.widgets.system_status.label')}
            icon={AlertCircle}
            message={t('dashboards.widgets.system_status.placeholder')}
            isEditing={isEditing}
            onConfigure={onConfigure}
            variant={config.appearance.variant}
          />
        ) : (
          <div className="space-y-3 @md:space-y-5 animate-in fade-in duration-500">
            {/* CPU Metric */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-micro font-black uppercase tracking-widest mb-1 px-1">
                <span className="text-muted-foreground/60 flex items-center gap-1.5">
                   <Zap className="w-3 h-3" /> {t('dashboards.widgets.system_status.processor')}
                </span>
                <span className={getMetricColor(snapshot.cpuUsage)}>{Math.round(snapshot.cpuUsage)}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000 ease-out", getMetricBg(snapshot.cpuUsage))} 
                  style={{ width: `${snapshot.cpuUsage}%` }} 
                />
              </div>
            </div>

            {/* RAM Metric */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-micro font-black uppercase tracking-widest mb-1 px-1">
                <span className="text-muted-foreground/60 flex items-center gap-1.5">
                   <HardDrive className="w-3 h-3" /> {t('dashboards.widgets.system_status.memory')}
                </span>
                <span className={getMetricColor(snapshot.memoryUsage.percentage)}>{Math.round(snapshot.memoryUsage.percentage)}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000 ease-out", getMetricBg(snapshot.memoryUsage.percentage))} 
                  style={{ width: `${snapshot.memoryUsage.percentage}%` }} 
                />
              </div>
              <p className="text-micro text-muted-foreground/30 font-bold uppercase tracking-tight text-right px-1">
                {Math.round(snapshot.memoryUsage.used / 1024)}GB / {Math.round(snapshot.memoryUsage.total / 1024)}GB
              </p>
            </div>

            {/* Uptime Insight */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/10 min-w-0">
               <div className="p-2 rounded-xl bg-background border border-border/30">
                  <Timer className="w-3 h-3 text-muted-foreground" />
               </div>
               <div>
                  <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-1">{t('dashboards.widgets.system_status.uptime')}</p>
                  <p className="text-caption font-black text-foreground tracking-tight">{formatUptime(snapshot.uptime)}</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
