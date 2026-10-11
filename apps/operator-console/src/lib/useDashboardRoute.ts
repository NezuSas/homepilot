import { useEffect, useMemo, useRef } from 'react';
import { matchPath } from 'react-router-dom';
import { DASHBOARDS_ONE_PATTERN, DASHBOARDS_TAB_PATTERN } from './viewNavigation';

export interface RememberedDashboardTab {
  dashboardId: string;
  tabId: string;
}

/**
 * Reads the dashboard and tab ids from the URL. The last visited tab is kept
 * in memory only (not storage): it survives sidebar navigation within this page
 * load and is gone after a reload, where the "default tab" flag takes over.
 */
export function useDashboardRoute(pathname: string) {
  const tabMatch = useMemo(() => matchPath(DASHBOARDS_TAB_PATTERN, pathname), [pathname]);
  const oneMatch = useMemo(
    () => (tabMatch ? null : matchPath(DASHBOARDS_ONE_PATTERN, pathname)),
    [tabMatch, pathname],
  );
  const dashboardId = tabMatch?.params.dashboardId ?? oneMatch?.params.dashboardId ?? null;
  const tabId = tabMatch?.params.tabId ?? null;
  const lastTabRef = useRef<RememberedDashboardTab | null>(null);

  useEffect(() => {
    if (tabMatch?.params.dashboardId && tabMatch?.params.tabId) {
      lastTabRef.current = { dashboardId: tabMatch.params.dashboardId, tabId: tabMatch.params.tabId };
    }
  }, [tabMatch]);

  return { dashboardId, tabId, lastTabRef };
}

/** Path to open for a dashboard, honouring the remembered tab when it belongs to it. */
export function getDashboardPath(dashboardId: string, remembered: RememberedDashboardTab | null): string {
  return remembered && remembered.dashboardId === dashboardId
    ? `/dashboards/${remembered.dashboardId}/${remembered.tabId}`
    : `/dashboards/${dashboardId}`;
}
