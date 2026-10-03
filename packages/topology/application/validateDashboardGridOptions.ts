import type { DashboardTab } from '../domain/Dashboard';
import { normalizeSectionTabs } from '../domain/DashboardSectionLayout';
import { readCardGridOptions } from './readDashboardSections';

/** Validate only new geometry fields; historical card-specific metadata stays opaque. */
export function validateDashboardGridOptions(tabs: DashboardTab[]): void {
  try {
    for (const tab of normalizeSectionTabs(tabs)) {
      for (const widget of tab.widgets) {
        if (widget.type !== 'section') continue;
        const extra = widget.config.extra;
        if (!extra || typeof extra !== 'object' || !('cards' in extra) || !Array.isArray(extra.cards)) continue;
        for (const card of extra.cards) {
          if (card && typeof card === 'object' && 'gridOptions' in card && card.gridOptions !== undefined) readCardGridOptions(card.gridOptions);
        }
      }
    }
  } catch { throw new Error('DASHBOARD_LAYOUT_INVALID'); }
}
