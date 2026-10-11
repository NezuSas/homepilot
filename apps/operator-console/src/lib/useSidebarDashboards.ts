import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDashboards } from '../views/dashboards/dashboardOperations';
import type { View } from '../types';
import type { RememberedDashboardTab } from './useDashboardRoute';

export interface SidebarDashboard {
  id: string;
  ownerId: string;
  title: string;
}

interface Options {
  canAccessDashboards: boolean;
  currentView: View;
  urlDashboardId: string | null;
  userId: string | undefined;
  lastTabRef: MutableRefObject<RememberedDashboardTab | null>;
}

/**
 * Dashboards listed in the sidebar nested menu, plus the fallback redirect when
 * the user lands on bare /dashboards.
 */
export function useSidebarDashboards({ canAccessDashboards, currentView, urlDashboardId, userId, lastTabRef }: Options) {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<SidebarDashboard[]>([]);

  // Only fetches the list, with no navigation side effects. Its identity depends on
  // `canAccessDashboards` alone: depending on the URL made it change on every
  // route change and bounced the user back when leaving Tableros.
  const refresh = useCallback(async () => {
    if (!canAccessDashboards) {
      setDashboards([]);
      return;
    }

    try {
      const data = await loadDashboards('No se pudieron cargar los tableros.');
      setDashboards(data.map(dashboard => ({
        id: dashboard.id,
        ownerId: dashboard.ownerId,
        title: dashboard.title,
      })));
    } catch (error) {
      console.warn('[AppShell] Failed to refresh sidebar dashboards:', error);
      setDashboards([]);
    }
  }, [canAccessDashboards]);

  // Gating on `currentView` keeps this from redirecting the user while they are
  // looking at a different section.
  useEffect(() => {
    if (currentView !== 'dashboards' || urlDashboardId) return;
    if (dashboards.length === 0) return;

    const remembered = lastTabRef.current;
    if (remembered && dashboards.some(dashboard => dashboard.id === remembered.dashboardId)) {
      navigate(`/dashboards/${remembered.dashboardId}/${remembered.tabId}`, { replace: true });
      return;
    }

    const ownedDashboard = dashboards.find(dashboard => dashboard.ownerId === userId);
    const fallbackId = ownedDashboard?.id ?? dashboards[0]?.id ?? null;
    if (fallbackId) navigate(`/dashboards/${fallbackId}`, { replace: true });
  }, [currentView, urlDashboardId, dashboards, userId, navigate, lastTabRef]);

  return { dashboards, setDashboards, refresh };
}
