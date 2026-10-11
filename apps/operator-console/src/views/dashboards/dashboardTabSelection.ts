import type { Dashboard, DashboardTab } from './types';

/** The tab marked as default opens on load/reload instead of the first tab. */
export function getDefaultTabIndex(dashboard: Dashboard): number {
  const idx = dashboard.tabs.findIndex(tab => tab.isDefault);
  return idx >= 0 ? idx : 0;
}

/** The URL's tab id wins over the "default tab" flag: it reflects exactly
 * where the user was (or the link they were given), not just a static pick. */
export function getInitialTabIndex(dashboard: Dashboard, preferredTabId?: string | null): number {
  if (preferredTabId) {
    const idx = dashboard.tabs.findIndex(tab => tab.id === preferredTabId);
    if (idx >= 0) return idx;
  }
  return getDefaultTabIndex(dashboard);
}

/** Owners see every tab; other users only the tabs shared with them. */
export function getVisibleTabs(dashboard: Dashboard | null, user: { id: string } | null): DashboardTab[] {
  if (!dashboard) return [];
  if (!user) return dashboard.tabs;
  if (dashboard.ownerId === user.id) return dashboard.tabs;
  return dashboard.tabs.filter(tab => {
    const usersList = tab.visibility?.users;
    return Boolean(usersList?.includes(user.id));
  });
}

/** Index to switch to when the selected tab is missing or hidden; null when the selection is still valid. */
export function resolveVisibleTabIndex(dashboard: Dashboard, visibleTabs: DashboardTab[], activeTabIdx: number): number | null {
  if (visibleTabs.length === 0) return null;
  const currentActiveTab = dashboard.tabs[activeTabIdx];
  if (!currentActiveTab) return 0;
  const isStillVisible = visibleTabs.some(tab => tab.id === currentActiveTab.id);
  if (isStillVisible) return null;
  const firstVisibleIdx = dashboard.tabs.findIndex(tab => tab.id === visibleTabs[0].id);
  return firstVisibleIdx >= 0 ? firstVisibleIdx : 0;
}

/** Maps an index in the visible tab strip back to the dashboard's own tab list; null when there is no such tab. */
export function toDashboardTabIndex(dashboard: Dashboard, visibleTabs: DashboardTab[], visibleIndex: number): number | null {
  const targetTab = visibleTabs[visibleIndex];
  if (!targetTab) return null;
  const originalIdx = dashboard.tabs.findIndex(tab => tab.id === targetTab.id);
  return originalIdx >= 0 ? originalIdx : 0;
}
