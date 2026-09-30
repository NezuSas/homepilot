import type { Dashboard, DashboardTab, DashboardWidget } from './Dashboard';

/** Normalize only the outer Section span. Child cards and sparse slot maps are untouched. */
export function normalizeSectionWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget) => {
    if (widget.type !== 'section') return widget;
    const layout = widget.config.layout;
    const fields = layout && typeof layout === 'object' && !Array.isArray(layout)
      ? layout as Record<string, unknown> : {};
    if (fields.span === 1) return widget;
    return { ...widget, config: { ...widget.config, layout: { ...fields, span: 1 } } };
  });
}

export function normalizeSectionTabs(tabs: DashboardTab[]): DashboardTab[] {
  return tabs.map((tab) => ({ ...tab, widgets: normalizeSectionWidgets(tab.widgets) }));
}

export function normalizeDashboardSections(dashboard: Dashboard): Dashboard {
  return { ...dashboard, tabs: normalizeSectionTabs(dashboard.tabs) };
}
