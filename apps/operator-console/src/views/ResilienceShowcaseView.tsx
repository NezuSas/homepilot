import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckCircle2, Home, Router, Workflow } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { LoadingState } from '../components/ui/LoadingState';

export const ResilienceShowcaseView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const [scenes, setScenes] = useState<unknown[]>([]);
  const [automations, setAutomations] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadSystemStatus = async () => {
      try {
        const [sceneData, automationData] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/v1/scenes`),
          apiFetch(`${API_BASE_URL}/api/v1/automations`),
          refreshSnapshot(),
        ]);
        if (!isMounted) return;
        setScenes(Array.isArray(sceneData) ? sceneData : []);
        setAutomations(Array.isArray(automationData) ? automationData : []);
        setIsConnected(true);
        setLastCheckedAt(new Date());
      } catch {
        if (isMounted) setIsConnected(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadSystemStatus();
    return () => { isMounted = false; };
  }, [refreshSnapshot]);

  const spacesCount = useMemo(
    () => Object.values(roomsByHome).reduce((total, rooms) => total + rooms.length, 0),
    [roomsByHome],
  );
  const checkedAt = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : null;

  if (isLoading && devices.length === 0) return <LoadingState label={t('system_status.loading')} />;

  const cards = [
    { icon: Router, label: t('system_status.connection'), value: isConnected ? t('system_status.connected') : t('system_status.check_required'), description: isConnected ? t('system_status.connection_ok') : t('system_status.connection_pending'), healthy: isConnected },
    { icon: Activity, label: t('system_status.devices'), value: devices.length.toString(), description: t('system_status.devices_description'), healthy: true },
    { icon: Home, label: t('system_status.spaces'), value: spacesCount.toString(), description: t('system_status.spaces_description', { homes: homes.length }), healthy: true },
    { icon: Workflow, label: t('system_status.routines'), value: (scenes.length + automations.length).toString(), description: t('system_status.routines_description', { scenes: scenes.length, automations: automations.length }), healthy: true },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {isConnected ? t('system_status.system_ready') : t('system_status.verification_in_progress')}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('system_status.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{t('system_status.description')}</p>
          </div>
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('system_status.summary_title')}</p>
            <p className="mt-1">{checkedAt ? t('system_status.last_checked', { time: checkedAt }) : t('system_status.not_checked')}</p>
          </div>
        </div>
      </section>
      <section aria-label={t('system_status.summary_label')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, description, healthy }) => (
          <article key={label} className="min-h-44 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-xl p-2.5 ${healthy ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${healthy ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>{value}</span>
            </div>
            <h2 className="mt-5 text-base font-semibold text-foreground">{label}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <p className="text-sm font-semibold text-foreground">{t('system_status.privacy_title')}</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t('system_status.privacy_description')}</p>
      </section>
    </main>
  );
};

export default ResilienceShowcaseView;
