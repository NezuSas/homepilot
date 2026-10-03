import type { Dashboard, DashboardTab, DashboardWidget } from './Dashboard';

export type SectionColumns = 1 | 2 | 3 | 4;
export type CardColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface CardGridOptions {
  columns: CardColumns | 'full';
  rows: number | 'auto';
  minColumns?: CardColumns;
  maxColumns?: CardColumns;
  minRows?: number;
  maxRows?: number;
}

/** Additional presenter-specific fields and bindings must survive conversion. */
export interface DashboardSectionCard extends Record<string, unknown> {
  id: string;
  kind: string;
  gridOptions: CardGridOptions;
}

export interface DashboardSection extends Record<string, unknown> {
  id: string;
  columnSpan: SectionColumns;
  /** Existing appearance/visibility/binding/extra metadata, excluding extra.cards. */
  config: Record<string, unknown>;
  cards: DashboardSectionCard[];
}

export interface DashboardSectionsTab extends Omit<DashboardTab, 'widgets'> {
  maxColumns: SectionColumns;
  sections: DashboardSection[];
  /** Non-section widgets, including the existing dashboard header. */
  widgets: DashboardWidget[];
  /** Compatibility hint for mixed V1 canvases; section ordering belongs to sections[]. */
  legacyWidgetOrder: string[];
}

/** In-memory editor model. Storage and transfer retain the compatible V1 envelope. */
export interface DashboardSections extends Omit<Dashboard, 'tabs'> {
  layoutVersion: 2;
  tabs: DashboardSectionsTab[];
}
