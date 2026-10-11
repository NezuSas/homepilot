import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getInitialTabIndex } from './dashboardTabSelection';
import type { Dashboard } from './types';

interface DashboardRouteSyncInput {
  dashboards: Dashboard[];
  active: Dashboard | null;
  activeTabIdx: number;
  initialDashboardId: string | null;
  initialTabId: string | null;
  setActive: (dashboard: Dashboard) => void;
  setActiveTabIdx: (index: number) => void;
  setSelectedWidgetId: (id: string | null) => void;
}

/** Keeps the active dashboard/tab and the `/dashboards/:id/:tab` URL in agreement. */
export function useDashboardRouteSync({
  dashboards, active, activeTabIdx, initialDashboardId, initialTabId, setActive, setActiveTabIdx, setSelectedWidgetId,
}: DashboardRouteSyncInput) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastResolvedRouteDashboardId = useRef(initialDashboardId);

  useEffect(() => {
    if (!initialDashboardId || initialDashboardId === lastResolvedRouteDashboardId.current) return;
    const selected = dashboards.find(dashboard => dashboard.id === initialDashboardId);
    if (!selected) return;
    lastResolvedRouteDashboardId.current = initialDashboardId;
    setActive(selected);
    setActiveTabIdx(getInitialTabIndex(selected, initialTabId));
    setSelectedWidgetId(null);
  }, [dashboards, initialDashboardId, initialTabId, setActive, setActiveTabIdx, setSelectedWidgetId]);

  // Incoming route changes own selection; local changes own the route.
  // Replacing the dashboard object (e.g. import/save) is not incoming navigation.
  const resolvedTabPath = useRef(location.pathname);
  useEffect(() => {
    if (!active) return;
    // On an incoming dashboard navigation, `active` still refers to the old
    // dashboard for one render. Do not replace the new route with the old ID.
    if (initialDashboardId && active.id !== initialDashboardId) return;
    if (resolvedTabPath.current !== location.pathname) {
      resolvedTabPath.current = location.pathname;
      const incomingIndex = active.tabs.findIndex(candidate => candidate.id === initialTabId);
      if (incomingIndex >= 0 && incomingIndex !== activeTabIdx) {
        setActiveTabIdx(incomingIndex);
        return;
      }
    }
    const tab = active.tabs[activeTabIdx];
    if (!tab) return;
    const targetPath = `/dashboards/${active.id}/${tab.id}`;
    if (location.pathname !== targetPath) {
      resolvedTabPath.current = targetPath;
      navigate(targetPath, { replace: true });
    }
  }, [active, activeTabIdx, initialDashboardId, initialTabId, location.pathname, navigate, setActiveTabIdx]);
}
