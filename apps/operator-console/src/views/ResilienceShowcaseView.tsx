import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckCircle2, Home, Router, Workflow } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatusPill } from '../components/ui/StatusPill';
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
    { icon: Router, label: t('system_status.connection'), value: isConnected ? t('system_status.connected') : t('system_status.check_required'), description: isConnected ? t('system_status.connection_ok') : t('system_status.connection_pending'), tone: isConnected ? 'success' as const : 'warning' as const },
    { icon: Activity, label: t('system_status.devices'), value: devices.length.toString(), description: t('system_status.devices_description'), tone: 'success' as const },
    { icon: Home, label: t('system_status.spaces'), value: spacesCount.toString(), description: t('system_status.spaces_description', { homes: homes.length }), tone: 'success' as const },
    { icon: Workflow, label: t('system_status.routines'), value: (scenes.length + automations.length).toString(), description: t('system_status.routines_description', { scenes: scenes.length, automations: automations.length }), tone: 'success' as const },
  ];

  return (
    <div className="mx-auto flex w-full max-w-content-wide flex-col gap-6 sm:gap-8">
      <SectionHeader
        level="view"
        icon={CheckCircle2}
        title={t('system_status.title')}
        subtitle={t('system_status.description')}
        action={
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-caption text-muted-foreground">
            <StatusPill variant={isConnected ? 'success' : 'warning'}>{isConnected ? t('system_status.system_ready') : t('system_status.verification_in_progress')}</StatusPill>
            <span>{checkedAt ? t('system_status.last_checked', { time: checkedAt }) : t('system_status.not_checked')}</span>
          </div>
        }
      />

      <section aria-label={t('system_status.summary_label')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, description, tone }) => (
          <Card key={label} className="flex min-h-40 flex-col gap-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <StatusPill variant={tone}>{value}</StatusPill>
            </div>
            <div>
              <h2 className="text-section-title font-semibold tracking-tight text-foreground">{label}</h2>
              <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </Card>
        ))}
      </section>

      <Card className="p-5 sm:p-6">
        <h2 className="text-section-title font-semibold tracking-tight text-foreground">{t('system_status.privacy_title')}</h2>
        <p className="mt-2 max-w-3xl text-caption leading-relaxed text-muted-foreground">{t('system_status.privacy_description')}</p>
      </Card>
    </div>
  );
};

export default ResilienceShowcaseView;