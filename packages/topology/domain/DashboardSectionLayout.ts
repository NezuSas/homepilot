import type { Dashboard, DashboardTab, DashboardWidget } from './Dashboard';

/** Normalize only the outer Section span. Child cards and sparse slot maps are untouched. */
export function normalizeSectionWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget) => {
    if (widget.type !== 'section') return widget;
    const layout = widget.config.layout;
    const fields = layout && typeof layout === 'object' && !Array.isArray(layout)
      ? layout as Record<string, unknown> : {};
    const extra = widget.config.extra as Record<string, unknown> | undefined;
    if (extra?.sectionGridVersion === 2) {
      if (typeof fields.span !== 'number' || !Number.isInteger(fields.span) || fields.span < 1 || fields.span > 4) throw new Error('INVALID_SECTION_SPAN');
      return widget;
    }
    if (fields.span === 1) return widget;
    return { ...widget, config: { ...widget.config, layout: { ...fields, span: 1 } } };
  });
}

export function normalizeSectionTabs(tabs: DashboardTab[]): DashboardTab[] {
  return tabs.map((tab) => {
    if (tab.maxColumns !== undefined && (!Number.isInteger(tab.maxColumns) || tab.maxColumns < 1 || tab.maxColumns > 4)) throw new Error('INVALID_DASHBOARD_COLUMNS');
    return { ...tab, widgets: normalizeSectionWidgets(tab.widgets) };
  });
}

export function normalizeDashboardSections(dashboard: Dashboard): Dashboard {
  return { ...dashboard, tabs: normalizeSectionTabs(dashboard.tabs) };
}
