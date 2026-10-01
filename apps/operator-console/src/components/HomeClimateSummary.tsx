import React, { useEffect, useState } from 'react';
import { CalendarDays, Cloud, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClockData } from '../views/dashboards/widgets/clock/useClockData';
import { formatMonth, formatTemperature, formatWeekday } from '../views/dashboards/widgets/clock/clockUtils';
import { loadDashboards } from '../views/dashboards/dashboardOperations';
import { SlideToDashboardButton } from './SlideToDashboardButton';
import { HomeContextIndicator } from './HomeContextIndicator';
import { HomeFlipClock } from './HomeFlipClock';

const configuredCity = (import.meta.env.VITE_HOME_CITY as string | undefined)?.trim() || 'Cuenca';

interface HomeClimateSummaryProps {
  currentUserId: string | null;
  onOpenOwnDashboardTab: (dashboardId: string, tabId: string) => void;
}

export const HomeClimateSummary: React.FC<HomeClimateSummaryProps> = ({ currentUserId, onOpenOwnDashboardTab }) => {
  const { i18n, t } = useTranslation();
  const { now, locale, copy, weather, weatherStatus } = useClockData(i18n.language);
  const isEnglish = locale.toLowerCase().startsWith('en');
  const dateLabel = isEnglish
    ? `${formatWeekday(now, locale, 'long')}, ${formatMonth(now, locale, 'long')} ${now.getDate()}`
    : `${formatWeekday(now, locale, 'long')}, ${now.getDate()} de ${formatMonth(now, locale, 'long')}`;
  const weatherReady = weatherStatus === 'ready' && weather !== null;
  const weatherLabel = weatherReady ? weather.label : weatherStatus === 'loading' || weatherStatus === 'idle' ? copy.weatherLoading : copy.weatherUnavailable;
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
      <div className="flex min-w-0 flex-col items-start gap-2">
        <HomeFlipClock now={now} />
        <div className="homepilot-home-context flex min-w-0 max-w-full flex-wrap items-center justify-start gap-2">
          <HomeContextIndicator icon={MapPin} primaryIcon className="homepilot-home-chip">
            {weather?.location ?? configuredCity}
          </HomeContextIndicator>
          <HomeContextIndicator icon={CalendarDays} className="homepilot-home-chip">
            {dateLabel}
          </HomeContextIndicator>
          <HomeContextIndicator icon={Cloud} className="homepilot-home-chip">
            <span className="tabular-nums">{weatherReady ? formatTemperature(weather.temperature) : '—'}</span>
            <span className="homepilot-home-chip-divider" aria-hidden="true" />
            <span className="font-normal text-muted-foreground">{weatherLabel}</span>
          </HomeContextIndicator>
        </div>
        <div className="mt-1 text-left text-micro leading-tight text-muted-foreground" aria-label="HomePilot by NEZU">
          <span className="block font-semibold text-foreground/70">HomePilot</span>
          <span className="block">by NEZU</span>
        </div>
      </div>
      <SlideToDashboardButton
        label={t('dashboard.open_dashboard')}
        accessibleLabel={ownDefault ? t('dashboard.slide_own_default_tab', { title: ownDefault.title }) : t('dashboard.no_default_tab')}
        instruction={t('dashboard.slide_dashboard_instruction')}
        disabled={!ownDefault}
        onActivate={() => { if (ownDefault) onOpenOwnDashboardTab(ownDefault.dashboardId, ownDefault.tabId); }}
      />
    </div>
  );
};
