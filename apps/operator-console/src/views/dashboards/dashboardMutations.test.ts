import { configureTab, createDefaultWidgetConfig, insertWidget, updateWidgetConfig } from './dashboardMutations';
import type { DashboardTab, DashboardWidget } from './types';

const labels = {
  titleArea: 'Title area',
  newSection: 'New section',
  titlePlaceholder: 'Welcome',
  subtitlePlaceholder: 'Local home',
};

const section: DashboardWidget = {
  id: 'section-1',
  type: 'section',
  config: createDefaultWidgetConfig('section', undefined, labels),
};

const tabs: DashboardTab[] = [
  { id: 'first', title: 'First', isDefault: true, widgets: [section] },
  { id: 'second', title: 'Second', widgets: [] },
];

describe('dashboard mutation contracts', () => {
  it('preserves legacy layout defaults and title placeholder content', () => {
    const title = createDefaultWidgetConfig('dashboard_title', { w: 3, h: 7 }, labels);
    expect(title.layout).toMatchObject({ w: 12, h: 2, span: undefined });
    expect(title.extra).toMatchObject({ markdown: '# Welcome\nLocal home', align: 'center' });
    expect(createDefaultWidgetConfig('section', undefined, labels).appearance.title).toBe('New section');
  });

  it('pins a new title before other widgets without mutating the original tabs', () => {
    const title: DashboardWidget = { id: 'title-1', type: 'dashboard_title', config: createDefaultWidgetConfig('dashboard_title', undefined, labels) };
    const updated = insertWidget(tabs, 0, title);
    expect(updated[0].widgets.map((widget) => widget.id)).toEqual(['title-1', 'section-1']);
    expect(tabs[0].widgets.map((widget) => widget.id)).toEqual(['section-1']);
  });

  it('keeps a single default tab when configuring another one', () => {
    const updated = configureTab(tabs, 1, { title: ' Second ', isDefault: true, background: null });
    expect(updated[0].isDefault).toBe(false);
    expect(updated[1]).toMatchObject({ title: 'Second', isDefault: true, background: undefined });
  });

  it('merges nested widget config while retaining unaffected fields', () => {
    const updated = updateWidgetConfig(tabs, 0, 'section-1', { appearance: { title: 'Lights' }, extra: { cards: [] } });
    expect(updated[0].widgets[0].config.appearance).toMatchObject({ title: 'Lights', variant: 'glass', showTitle: true });
    expect(updated[0].widgets[0].config.layout).toEqual(section.config.layout);
    expect(tabs[0].widgets[0].config.appearance.title).toBe('New section');
  });
});
