import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import type { Dashboard } from './types';
import { loadDashboards } from './dashboardOperations';
import { getInitialTabIndex } from './dashboardTabSelection';

interface DashboardCatalogInput {
  initialDashboardId: string | null;
  initialTabId: string | null;
  onDashboardCatalogChange?: (dashboards: Dashboard[]) => void;
}

/** Loads the dashboard catalog and owns which dashboard and tab are active. */
export function useDashboardCatalog({ initialDashboardId, initialTabId, onDashboardCatalogChange }: DashboardCatalogInput) {
  const { t } = useTranslation();
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const dashboardsRef = useRef(dashboards);
  const [active, setActive] = useState<Dashboard | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const publishDashboards = (update: (current: Dashboard[]) => Dashboard[]) => {
    const next = update(dashboardsRef.current);
    dashboardsRef.current = next;
    setDashboards(next);
    onDashboardCatalogChange?.(next);
    return next;
  };

  const fetchDashboards = useCallback(async (isInitial = false) => {
    try {
      const data = await loadDashboards(t('dashboards.error_load'));
      {
        setDashboards(data);
        dashboardsRef.current = data;
        onDashboardCatalogChange?.(data);
        setError('');
        if (data.length > 0) {
          if (isInitial) {
            const initialDashboard = data.find(dashboard => dashboard.id === initialDashboardId) ?? data[0];
            setActive(initialDashboard);
            setActiveTabIdx(getInitialTabIndex(initialDashboard, initialTabId));
          } else {
            const current = data.find(d => d.id === active?.id);
            if (current) setActive(current);
          }
        }
      }
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.error_load'));
    }
    finally { setLoading(false); }
  }, [active?.id, initialDashboardId, initialTabId, onDashboardCatalogChange, t]);

  useEffect(() => {
    fetchDashboards(true);
    void refreshSnapshot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Run only once on mount.

  return {
    dashboards, active, setActive, activeTabIdx, setActiveTabIdx,
    loading, error, setError, publishDashboards, fetchDashboards,
  };
}
