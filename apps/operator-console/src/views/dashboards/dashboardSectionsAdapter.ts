import { readDashboardSectionsTab } from '../../../../../packages/topology/application/readDashboardSections';
import type { DashboardWidget } from './types';

/** Sections are first-class in memory. The existing API envelope remains a
 * compatibility boundary, so opening a dashboard never rewrites its data. */
export function readCanvasSections(widgets: DashboardWidget[], id: string) {
  return readDashboardSectionsTab({ id, title: '', widgets: widgets.map(widget => ({ ...widget, config: { ...widget.config } })) });
}

/** Reuse presenters without making them depend on transport/migration logic.
 * Historical widths keep the same mobile density; only an explicit new size
 * uses exact gridOptions. No configuration is persisted by this adapter. */
export function projectCanvasSections(widgets: DashboardWidget[], model: ReturnType<typeof readCanvasSections>): DashboardWidget[] {
  const sections = new Map(model.sections.map(section => [section.id, section]));
  return widgets.map(widget => {
    const section = sections.get(widget.id);
    if (!section) return widget;
    const originals: unknown[] = Array.isArray(widget.config.extra?.cards) ? widget.config.extra.cards : [];
    return { ...widget, config: { ...widget.config,
      layout: { ...widget.config.layout, span: section.columnSpan },
      extra: { ...widget.config.extra, cards: section.cards.map(card => {
        const original = originals.find(value => value && typeof value === 'object' && 'id' in value && value.id === card.id);
        const { gridOptions, ...fields } = card;
        const exact = original && typeof original === 'object' && 'gridOptions' in original && original.gridOptions;
        const columns = gridOptions.columns === 'full' ? 12 : gridOptions.columns;
        return { ...fields, span: columns <= 3 ? 'small' : columns <= 6 ? 'medium' : 'full', ...(exact ? { gridOptions } : {}) };
      }) },
    } };
  });
}
