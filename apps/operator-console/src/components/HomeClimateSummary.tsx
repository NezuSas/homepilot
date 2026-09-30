import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, LayoutDashboard, MapPin, Thermometer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getHomeClimateTemperature } from './homeClimateWeather';
import { useCuencaWeather } from '../views/dashboards/widgets/clock/useCuencaWeather';
import { loadDashboards } from '../views/dashboards/dashboardOperations';
import { HomeContextIndicator } from './HomeContextIndicator';

const configuredCity = (import.meta.env.VITE_HOME_CITY as string | undefined)?.trim() || 'Cuenca';

interface HomeClimateSummaryProps {
  currentUserId: string | null;
  onOpenOwnDashboardTab: (dashboardId: string, tabId: string) => void;
}

export const HomeClimateSummary: React.FC<HomeClimateSummaryProps> = ({ currentUserId, onOpenOwnDashboardTab }) => {
  const { i18n, t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const { weather, status: weatherStatus } = useCuencaWeather(i18n.language);
  const temperature = getHomeClimateTemperature(weather, weatherStatus);
  const [ownDefault, setOwnDefault] = useState<{ dashboardId: string; tabId: string; title: string } | null>(null);

  useEffect(() => {
    if (!currentUserId) { setOwnDefault(null); return; }
    let active = true;
    void loadDashboards(t('dashboards.error_load')).then((dashboards) => {
      if (!active) return;
      const owned = dashboards.filter((dashboard) => dashboard.ownerId === currentUserId);
      const tab = owned.length === 1 ? owned[0].tabs.find((candidate) => candidate.isDefault) : undefined;
      setOwnDefault(tab ? { dashboardId: owned[0].id, tabId: tab.id, title: tab.title } : null);
    }).catch(() => { if (active) setOwnDefault(null); });
    return () => { active = false; };
  }, [currentUserId, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now), [i18n.language, now]);

  return (
    <div className="homepilot-home-context flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end" aria-label={t('dashboard.home_context')}>
      <HomeContextIndicator icon={MapPin} primaryIcon className="basis-full sm:basis-auto">{weather?.location ?? configuredCity}</HomeContextIndicator>
      <HomeContextIndicator icon={Clock3}><time className="tabular-nums" dateTime={now.toISOString()}>{formattedTime}</time></HomeContextIndicator>
      <HomeContextIndicator icon={Thermometer}>{temperature === null ? t('dashboard.temperature_unavailable') : `${temperature} °C`}</HomeContextIndicator>
      <HomeContextIndicator
        icon={LayoutDashboard}
        primaryIcon
        className="basis-full sm:basis-auto"
        onClick={ownDefault ? () => onOpenOwnDashboardTab(ownDefault.dashboardId, ownDefault.tabId) : undefined}
        actionLabel={ownDefault ? t('dashboard.open_own_default_tab', { title: ownDefault.title }) : undefined}
      >
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-muted-foreground">{t('dashboard.own_dashboard_indicator')}</span>
          <span className="truncate">{ownDefault?.title ?? t('dashboard.no_default_tab')}</span>
        </span>
      </HomeContextIndicator>
    </div>
  );
};
