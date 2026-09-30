import React, { useEffect, useState } from 'react';
import { LayoutDashboard, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClockData } from '../views/dashboards/widgets/clock/useClockData';
import { ClockDateTimeSummary, ClockWeatherSummary } from '../views/dashboards/widgets/clock/designs/ClockSummaries';
import { loadDashboards } from '../views/dashboards/dashboardOperations';
import { Button } from './ui/Button';

const configuredCity = (import.meta.env.VITE_HOME_CITY as string | undefined)?.trim() || 'Cuenca';

interface HomeClimateSummaryProps {
  currentUserId: string | null;
  onOpenOwnDashboardTab: (dashboardId: string, tabId: string) => void;
}

export const HomeClimateSummary: React.FC<HomeClimateSummaryProps> = ({ currentUserId, onOpenOwnDashboardTab }) => {
  const { i18n, t } = useTranslation();
  const { now, locale, copy, weather, weatherStatus } = useClockData(i18n.language);
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

  return (
    <div className="relative z-10 flex min-w-0 w-full flex-col gap-5" aria-label={t('dashboard.home_context')}>
      <Button
        type="button"
        size="md"
        className="self-end active:scale-[0.98]"
        disabled={!ownDefault}
        aria-label={ownDefault ? t('dashboard.open_own_default_tab', { title: ownDefault.title }) : t('dashboard.no_default_tab')}
        onClick={() => { if (ownDefault) onOpenOwnDashboardTab(ownDefault.dashboardId, ownDefault.tabId); }}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
        {ownDefault ? t('dashboard.open_dashboard') : t('dashboard.no_default_tab')}
      </Button>
      <div className="homepilot-home-context flex min-w-0 flex-wrap items-stretch gap-3">
        <ClockDateTimeSummary now={now} locale={locale} home />
        <ClockWeatherSummary now={now} weather={weather} status={weatherStatus} copy={copy} home />
        <div className="homepilot-home-summary flex min-w-0 items-center gap-2 rounded-card border border-border/60 bg-card/80 px-4 py-3 text-caption text-muted-foreground backdrop-blur-md">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{weather?.location ?? configuredCity}</span>
        </div>
      </div>
    </div>
  );
};
