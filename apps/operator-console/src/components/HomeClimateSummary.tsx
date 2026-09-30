import React, { useEffect, useState } from 'react';
import { LayoutDashboard, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClockData } from '../views/dashboards/widgets/clock/useClockData';
import { ClockDateTimeSummary, ClockWeatherSummary } from '../views/dashboards/widgets/clock/designs/ClockSummaries';
import { loadDashboards } from '../views/dashboards/dashboardOperations';
import { Button } from './ui/Button';
import { HomeContextIndicator } from './HomeContextIndicator';

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
    <div className="relative z-10 flex min-w-0 w-full flex-col gap-5 lg:flex-row lg:items-end lg:justify-between" aria-label={t('dashboard.home_context')}>
      <div className="flex min-w-0 flex-col items-start gap-3">
        <div className="homepilot-home-context flex min-w-0 flex-wrap items-start justify-start gap-3">
          <ClockDateTimeSummary now={now} locale={locale} home />
          <ClockWeatherSummary now={now} weather={weather} status={weatherStatus} copy={copy} home />
        </div>
        <HomeContextIndicator icon={MapPin} primaryIcon className="w-fit max-w-full flex-none">
          {weather?.location ?? configuredCity}
        </HomeContextIndicator>
        <div className="text-left text-micro leading-tight text-muted-foreground" aria-label="HomePilot by NEZU">
          <span className="block font-semibold text-foreground/70">HomePilot</span>
          <span className="block">by NEZU</span>
        </div>
      </div>
      <Button
        type="button"
        size="md"
        className="relative z-20 self-start isolate ring-2 ring-background/85 shadow-md active:scale-[0.98] disabled:border-border disabled:bg-card disabled:text-foreground disabled:opacity-100 disabled:shadow-sm lg:mb-0.5 lg:self-end"
        disabled={!ownDefault}
        aria-label={ownDefault ? t('dashboard.open_own_default_tab', { title: ownDefault.title }) : t('dashboard.no_default_tab')}
        title={!ownDefault ? t('dashboard.no_default_tab') : undefined}
        onClick={() => { if (ownDefault) onOpenOwnDashboardTab(ownDefault.dashboardId, ownDefault.tabId); }}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('dashboard.open_dashboard')}
      </Button>
    </div>
  );
};
