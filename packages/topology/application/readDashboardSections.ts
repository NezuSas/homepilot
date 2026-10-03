import type { Dashboard, DashboardTab, DashboardWidget } from '../domain/Dashboard';
import type {
  CardColumns, CardGridOptions, DashboardSection, DashboardSectionCard,
  DashboardSections, DashboardSectionsTab, SectionColumns,
} from '../domain/DashboardSections';

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid dashboard layout at ${path}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid dashboard layout at ${path}: expected integer ${min}..${max}`);
  }
  return value;
}

function identity(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid dashboard layout at ${path}: missing identity`);
  }
  return value;
}

function uniqueIds(items: ReadonlyArray<{ id: string }>, path: string): void {
  const seen = new Set<string>();
  items.forEach((item) => {
    const id = identity(item.id, `${path}.id`);
    if (seen.has(id)) throw new Error(`Invalid dashboard layout at ${path}: duplicate identity ${id}`);
    seen.add(id);
  });
}

/** Checks persisted sizes without silently clipping values or contradictory limits. */
export function readCardGridOptions(value: unknown): CardGridOptions {
  const raw = record(value, 'gridOptions');
  const columns = raw.columns === 'full' ? 'full'
    : integer(raw.columns, 1, 12, 'gridOptions.columns') as CardColumns;
  const rows = raw.rows === 'auto' ? 'auto'
    : integer(raw.rows, 1, Number.MAX_SAFE_INTEGER, 'gridOptions.rows');
  const result: CardGridOptions = { ...raw, columns, rows };
  for (const key of ['minColumns', 'maxColumns'] as const) {
    if (raw[key] !== undefined) result[key] = integer(raw[key], 1, 12, `gridOptions.${key}`) as CardColumns;
  }
  for (const key of ['minRows', 'maxRows'] as const) {
    if (raw[key] !== undefined) result[key] = integer(raw[key], 1, Number.MAX_SAFE_INTEGER, `gridOptions.${key}`);
  }
  const minColumns = result.minColumns ?? 1;
  const maxColumns = result.maxColumns ?? 12;
  const minRows = result.minRows ?? 1;
  const maxRows = result.maxRows ?? Number.MAX_SAFE_INTEGER;
  if (minColumns > maxColumns || minRows > maxRows
    || ((columns === 'full' ? 12 : columns) < minColumns || (columns === 'full' ? 12 : columns) > maxColumns)
    || (typeof rows === 'number' && (rows < minRows || rows > maxRows))) {
    throw new Error('Invalid dashboard layout at gridOptions: contradictory size limits');
  }
  return result;
}

function legacyColumns(card: Record<string, unknown>): CardColumns {
  if (card.span !== undefined && card.span !== 'small' && card.span !== 'medium' && card.span !== 'full') {
    throw new Error('Invalid dashboard layout at card.span');
  }
  const kind = card.kind;
  const clock = typeof kind === 'string' && (kind === 'clock' || kind.startsWith('clock_'));
  // Match V1 rendering, including stale widths on fixed-width media/clock cards.
  if (clock || kind === 'media') return 12;
  if (kind === 'sensor') return 6;
  if (card.span === 'small') return kind === 'light' || kind === 'action' ? 3 : 6;
  if (card.span === 'medium') return 6;
  if (card.span === 'full') return 12;
  return kind === 'camera' ? 12 : kind === 'light' ? 3 : 6;
}

function readCard(value: unknown, canonical: boolean): DashboardSectionCard {
  const raw = record(value, 'card');
  const id = identity(raw.id, 'card.id');
  const kind = raw.kind === undefined && !canonical ? 'device' : identity(raw.kind, 'card.kind');
  const fields = { ...raw };
  delete fields.order;
  delete fields.span;
  return {
    ...fields, id, kind,
    gridOptions: raw.gridOptions !== undefined
      ? readCardGridOptions(raw.gridOptions)
      : canonical
        ? readCardGridOptions(undefined)
        : { columns: legacyColumns({ ...raw, kind }), rows: 'auto' },
  };
}

function readSection(widget: DashboardWidget): DashboardSection {
  const config = { ...record(widget.config, 'section.config') };
  const extra = config.extra === undefined ? {} : { ...record(config.extra, 'section.extra') };
  if (extra.cards !== undefined && !Array.isArray(extra.cards)) {
    throw new Error('Invalid dashboard layout at section.extra.cards: expected an array');
  }
  const cards = (Array.isArray(extra.cards) ? extra.cards : []).map((card) => readCard(card, false));
  uniqueIds(cards, `section[${widget.id}].cards`);
  delete extra.cards;
  if (config.extra !== undefined) config.extra = extra;
  const metadata = { ...widget } as Record<string, unknown>;
  delete metadata.type;
  return {
    ...metadata, id: widget.id, config, cards,
    // The active V1 reader normalizes all historical Sections to one slot.
    columnSpan: extra.sectionGridVersion === 2
      ? integer(record(config.layout, 'section.layout').span, 1, 4, 'section.columnSpan') as SectionColumns : 1,
  };
}

/**
 * Pure, deterministic conversion of already-authorized dashboard data.
 * No storage, clock, random IDs, imports of UI code or side effects. Never use
 * normalizeCards here: its legacy filtering would discard historical cards.
 * The canvas reads this model in memory; the API/SQLite envelope stays compatible.
 */
export function readDashboardSections(input: Dashboard | DashboardSections): DashboardSections {
  const dashboard = structuredClone(input);
  const version = 'layoutVersion' in dashboard ? dashboard.layoutVersion : undefined;
  if (version !== undefined && version !== 2) throw new Error('Unsupported dashboard layout version');
  uniqueIds(dashboard.tabs, 'tabs');
  if (version === 2 && 'layoutVersion' in dashboard) {
    const tabs = dashboard.tabs.map((tab) => {
      uniqueIds(tab.sections, `tab[${tab.id}].sections`);
      uniqueIds([...tab.widgets, ...tab.sections], `tab[${tab.id}].items`);
      return {
        ...tab,
        maxColumns: integer(tab.maxColumns, 1, 4, 'tab.maxColumns') as SectionColumns,
        sections: tab.sections.map((section) => {
          const cards = section.cards.map((card) => readCard(card, true));
          uniqueIds(cards, `section[${section.id}].cards`);
          return { ...section, cards, columnSpan: integer(section.columnSpan, 1, 4, 'section.columnSpan') as SectionColumns };
        }),
      };
    });
    return { ...dashboard, tabs };
  }
  const tabs = dashboard.tabs.map(readDashboardSectionsTab);
  return { ...dashboard, layoutVersion: 2, tabs };
}

/** The canvas uses the same pure conversion as full-dashboard migration. */
export function readDashboardSectionsTab(input: DashboardTab): DashboardSectionsTab {
    const tab = structuredClone(input);
    uniqueIds(tab.widgets, `tab[${tab.id}].widgets`);
    return {
      ...tab,
      maxColumns: tab.maxColumns === undefined ? 4 : integer(tab.maxColumns, 1, 4, 'tab.maxColumns') as SectionColumns,
      legacyWidgetOrder: tab.widgets.map((widget) => widget.id),
      widgets: tab.widgets.filter((widget) => widget.type !== 'section'),
      sections: tab.widgets.filter((widget) => widget.type === 'section').map(readSection),
    };
}
