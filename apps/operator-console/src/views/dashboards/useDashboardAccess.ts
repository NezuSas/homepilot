import { useEffect, useMemo } from 'react';
import type { Dashboard } from './types';
import { getVisibleTabs, resolveVisibleTabIndex } from './dashboardTabSelection';

function readCurrentUser(): { id: string } | null {
  try {
    const raw = localStorage.getItem('hp_user_ctx');
    return raw ? JSON.parse(raw) as { id: string } | null : null;
  } catch {
    return null;
  }
}

/** Resolves ownership and visible tabs for the signed-in user, keeping the selected tab visible. */
export function useDashboardAccess(
  active: Dashboard | null,
  activeTabIdx: number,
  setActiveTabIdx: (index: number) => void,
) {
  const currentUser = useMemo(() => readCurrentUser(), []);

  const isOwner = Boolean(active && currentUser && active.ownerId === currentUser.id);

  const visibleTabs = useMemo(() => getVisibleTabs(active, currentUser), [active, currentUser]);

  // Adjust activeTabIdx if the currently selected tab is not visible
  useEffect(() => {
    if (!active) return;
    const nextIndex = resolveVisibleTabIndex(active, visibleTabs, activeTabIdx);
    if (nextIndex !== null) setActiveTabIdx(nextIndex);
  }, [active, visibleTabs, activeTabIdx, setActiveTabIdx]);

  return { isOwner, visibleTabs };
}
