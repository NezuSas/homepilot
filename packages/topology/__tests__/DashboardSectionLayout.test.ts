import { normalizeDashboardSections } from '../domain/DashboardSectionLayout';
import type { Dashboard } from '../domain/Dashboard';

describe('Section slot compatibility', () => {
  it('normalizes only historical outer spans, retaining cards, order and sparse layouts', () => {
    const dashboard: Dashboard = {
      id: 'dashboard', ownerId: 'owner', title: 'Casa',
      visibility: { roles: [], users: ['owner'], homes: [] },
      createdAt: '', updatedAt: '',
      tabs: [{ id: 'tab', title: 'Principal', sectionLayout: { columns4: ['a', null, 'b'] }, widgets: [
        { id: 'a', type: 'section', config: { layout: { w: 12, span: 4 }, extra: { cards: [{ id: 'first' }, { id: 'second' }] } } },
        { id: 'b', type: 'section', config: { layout: { w: 6 }, extra: { cards: [{ id: 'third' }] } } },
      ] }],
    };

    const normalized = normalizeDashboardSections(dashboard);
    expect(normalized.tabs[0].widgets.map((widget) => (widget.config.layout as { span: number }).span)).toEqual([1, 1]);
    expect(normalized.tabs[0].widgets.map((widget) => widget.config.extra)).toEqual(dashboard.tabs[0].widgets.map((widget) => widget.config.extra));
    expect(normalized.tabs[0].sectionLayout).toEqual({ columns4: ['a', null, 'b'] });
    expect(dashboard.tabs[0].widgets[0].config.layout).toEqual({ w: 12, span: 4 });
  });
});
