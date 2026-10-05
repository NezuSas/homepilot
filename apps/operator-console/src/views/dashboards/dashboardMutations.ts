import type { DashboardTab, DashboardWidget, DashboardWidgetConfig, WidgetType } from './types';
import { getClockGridOptions } from './widgets/clock/clockRegistry';

interface WidgetLabels {
  titleArea: string;
  newSection: string;
  titlePlaceholder: string;
  subtitlePlaceholder: string;
}

export interface TabConfigFields {
  maxColumns?: 1 | 2 | 3 | 4;
  title: string;
  icon?: string;
  background?: string | null;
  backgroundOpacity?: number;
  visibility?: { users: string[] };
  isDefault?: boolean;
}

export function createDefaultWidgetConfig(type: WidgetType, size: { w: number; h: number } | undefined, labels: WidgetLabels): DashboardWidgetConfig {
  const isDashboardTitle = type === 'dashboard_title';
  const isSection = type === 'section';
  const clock = type === 'clock_display' ? getClockGridOptions() : null;

  // Legacy coordinates remain persisted, but the canvas uses array order and span.
  return {
    layout: {
      x: 0,
      y: 0,
      w: clock ? Number(clock.columns) : isDashboardTitle ? 12 : isSection ? 4 : (size?.w ?? 4),
      h: clock ? Number(clock.rows) : isDashboardTitle ? 2 : isSection ? 2 : (size?.h ?? 4),
      span: isDashboardTitle ? undefined : 1,
    },
    binding: { entityId: '', entityType: 'system' },
    visibility: { rules: [], defaultState: 'show' },
    appearance: {
      variant: 'glass',
      title: isDashboardTitle ? labels.titleArea : isSection ? labels.newSection : '',
      showTitle: true,
    },
    extra: isDashboardTitle
      ? { markdown: `# ${labels.titlePlaceholder}\n${labels.subtitlePlaceholder}`, align: 'center' }
      : {},
  };
}

export function insertWidget(tabs: DashboardTab[], tabIndex: number, widget: DashboardWidget): DashboardTab[] {
  const inserted = widget.type === 'section'
    ? { ...widget, config: { ...widget.config, layout: { ...widget.config.layout, span: 1 } } }
    : widget;
  return tabs.map((tab, index) => index !== tabIndex ? tab : {
    ...tab,
    widgets: widget.type === 'dashboard_title'
      ? [inserted, ...tab.widgets]
      : [...tab.widgets, inserted],
  });
}

export function configureTab(tabs: DashboardTab[], tabIndex: number, fields: TabConfigFields): DashboardTab[] {
  return tabs.map((tab, index) => index === tabIndex ? {
    ...tab,
    title: fields.title.trim(),
    maxColumns: fields.maxColumns ?? tab.maxColumns,
    icon: fields.icon,
    background: fields.background === null ? undefined : fields.background,
    backgroundOpacity: fields.backgroundOpacity,
    visibility: fields.visibility,
    isDefault: fields.isDefault ?? false,
  } : (fields.isDefault ? { ...tab, isDefault: false } : tab));
}

export function updateWidgetConfig(tabs: DashboardTab[], tabIndex: number, widgetId: string, newConfig: Partial<DashboardWidgetConfig>): DashboardTab[] {
  return tabs.map((tab, index) => index !== tabIndex ? tab : {
    ...tab,
    widgets: tab.widgets.map((widget) => widget.id !== widgetId ? widget : {
      ...widget,
      config: {
        ...widget.config,
        ...newConfig,
        appearance: { ...widget.config.appearance, ...(newConfig.appearance || {}) },
        visibility: { ...widget.config.visibility, ...(newConfig.visibility || {}) },
        binding: { ...widget.config.binding, ...(newConfig.binding || {}) },
        layout: { ...widget.config.layout, ...(newConfig.layout || {}), ...(widget.type === 'section' && (newConfig.extra?.sectionGridVersion ?? widget.config.extra?.sectionGridVersion) !== 2 ? { span: 1 } : {}) },
        extra: { ...widget.config.extra, ...(newConfig.extra || {}) },
      },
    }),
  });
}
