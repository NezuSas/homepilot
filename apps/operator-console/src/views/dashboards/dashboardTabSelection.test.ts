import { getDefaultTabIndex, getInitialTabIndex, getVisibleTabs, resolveVisibleTabIndex, toDashboardTabIndex } from './dashboardTabSelection';
import type { Dashboard, DashboardTab } from './types';

function tab(id: string, extra: Partial<DashboardTab> = {}): DashboardTab {
  return { id, title: id, widgets: [], ...extra } as DashboardTab;
}

function dashboard(tabs: DashboardTab[], ownerId = 'owner'): Dashboard {
  return { id: 'd1', title: 'D', ownerId, tabs } as Dashboard;
}

describe('Feature: dashboard tab selection', () => {
  it('opens the default tab, or the first one when none is flagged', () => {
    expect(getDefaultTabIndex(dashboard([tab('a'), tab('b', { isDefault: true })]))).toBe(1);
    expect(getDefaultTabIndex(dashboard([tab('a'), tab('b')]))).toBe(0);
  });

  it('prefers the tab from the URL over the default flag', () => {
    const subject = dashboard([tab('a'), tab('b', { isDefault: true }), tab('c')]);
    expect(getInitialTabIndex(subject, 'c')).toBe(2);
    expect(getInitialTabIndex(subject, 'missing')).toBe(1);
    expect(getInitialTabIndex(subject, null)).toBe(1);
  });

  it('shows owners every tab and other users only the tabs shared with them', () => {
    const subject = dashboard([tab('a'), tab('b', { visibility: { users: ['guest'] } } as Partial<DashboardTab>)]);
    expect(getVisibleTabs(null, null)).toEqual([]);
    expect(getVisibleTabs(subject, null)).toHaveLength(2);
    expect(getVisibleTabs(subject, { id: 'owner' })).toHaveLength(2);
    expect(getVisibleTabs(subject, { id: 'guest' }).map(item => item.id)).toEqual(['b']);
    expect(getVisibleTabs(subject, { id: 'stranger' })).toEqual([]);
  });

  it('moves the selection only when the current tab is missing or hidden', () => {
    const subject = dashboard([tab('a'), tab('b'), tab('c')]);
    expect(resolveVisibleTabIndex(subject, [], 1)).toBeNull();
    expect(resolveVisibleTabIndex(subject, subject.tabs, 1)).toBeNull();
    expect(resolveVisibleTabIndex(subject, subject.tabs, 9)).toBe(0);
    expect(resolveVisibleTabIndex(subject, [subject.tabs[2]], 0)).toBe(2);
  });

  it('maps visible tab positions back to the dashboard tab list', () => {
    const subject = dashboard([tab('a'), tab('b'), tab('c')]);
    expect(toDashboardTabIndex(subject, [subject.tabs[1], subject.tabs[2]], 1)).toBe(2);
    expect(toDashboardTabIndex(subject, [subject.tabs[1]], 5)).toBeNull();
    expect(toDashboardTabIndex(subject, [tab('ghost')], 0)).toBe(0);
  });
});
