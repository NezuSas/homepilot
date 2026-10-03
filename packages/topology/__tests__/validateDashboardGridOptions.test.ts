import { validateDashboardGridOptions } from '../application/validateDashboardGridOptions';
import { legacyDashboard } from './fixtures/legacyDashboard';

describe('Feature: Dashboard geometry validation (AC48)', () => {
  it('Scenario: Old dashboards and configured bounds are accepted without mutation', () => {
    const { tabs } = legacyDashboard();
    const before = JSON.stringify(tabs);
    expect(() => validateDashboardGridOptions(tabs)).not.toThrow();
    expect(JSON.stringify(tabs)).toBe(before);
    tabs[0].widgets[1].config.extra = { cards: [{ gridOptions: { columns: 5, rows: 4 } }] };
    expect(() => validateDashboardGridOptions(tabs)).not.toThrow();
  });
  it.each([{ columns: 13, rows: 'auto' }, { columns: 3, rows: 0 }, { columns: 6, rows: 1.5 }, { columns: 'full', rows: 'auto', maxColumns: 6 }])('Scenario: Invalid size %j is rejected before persistence', gridOptions => {
    const { tabs } = legacyDashboard();
    tabs[0].widgets[1].config.extra = { cards: [{ gridOptions }] };
    expect(() => validateDashboardGridOptions(tabs)).toThrow('DASHBOARD_LAYOUT_INVALID');
  });
});
