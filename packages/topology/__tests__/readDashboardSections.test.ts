import type { Dashboard } from '../domain/Dashboard';
import { readCardGridOptions, readDashboardSections } from '../application/readDashboardSections';
import { legacyDashboard } from './fixtures/legacyDashboard';

function freezeDeep(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
}

describe('Feature: Sections editor model (AC46–AC47)', () => {
  it('Scenario: migrates small/medium/full to 3/6/12 and uses array order only', () => {
    const result = readDashboardSections(legacyDashboard());
    const section = result.tabs[0].sections[0];
    expect(result.layoutVersion).toBe(2);
    expect(result.tabs[0].maxColumns).toBe(4);
    expect(section.columnSpan).toBe(1);
    expect(section.cards.map((card) => card.id)).toEqual(['card-a', 'card-b', 'card-c']);
    expect(section.cards.map((card) => card.gridOptions)).toEqual([
      { columns: 3, rows: 'auto' }, { columns: 6, rows: 'auto' }, { columns: 12, rows: 'auto' },
    ]);
    for (const card of section.cards) {
      expect(card).not.toHaveProperty('order');
      expect(card).not.toHaveProperty('span');
    }
    expect(section.config.extra).not.toHaveProperty('cards');
    expect(section).not.toHaveProperty('type');
  });

  it('Scenario: preserves bindings, presenter settings and section metadata', () => {
    const section = readDashboardSections(legacyDashboard()).tabs[0].sections[0];
    expect(section.cards[0]).toMatchObject({ entityId: 'example-light', icon: 'mdi:lightbulb' });
    expect(section.cards[1]).toMatchObject({ sensorScale: { min: -20, max: 80 }, sensorDecimals: true, visualStyle: 'level' });
    expect(section.cards[2]).toMatchObject({ mediaVariant: 'classic', entityId: 'example-player' });
    expect(section.config).toMatchObject({
      appearance: { title: 'Example section', icon: 'mdi:home', showTitle: true },
      binding: { entityId: 'example-room' },
      extra: { customSectionOption: { retained: true } },
    });
  });

  it('Scenario: preserves header, standalone widget and mixed historical canvas order', () => {
    const input = legacyDashboard();
    const result = readDashboardSections(input);
    expect(result.tabs[0].widgets).toEqual([input.tabs[0].widgets[0], input.tabs[0].widgets[2]]);
    expect(result.tabs[0].legacyWidgetOrder).toEqual(['header', 'section-a', 'standalone', 'empty']);
    expect(result.tabs[0].sections.map((section) => section.id)).toEqual(['section-a', 'empty']);
    expect(result.tabs[0].sections[1]).toMatchObject({ columnSpan: 1, cards: [], config: { appearance: { showTitle: false } } });
  });

  it('Scenario: preserves permissions, backgrounds, tab settings and unknown fields', () => {
    const input = legacyDashboard();
    const tab = { ...input.tabs[0], sectionLayout: { columns2: ['section-a', null, 'empty'] }, custom: 'preserved' };
    const result = readDashboardSections({ ...input, tabs: [tab] });
    expect(result).toMatchObject({ ownerId: input.ownerId, visibility: input.visibility, createdAt: input.createdAt, updatedAt: input.updatedAt });
    expect(result.tabs[0]).toMatchObject({
      id: tab.id, title: tab.title, background: tab.background, backgroundOpacity: 0.5,
      isDefault: true, visibility: tab.visibility, icon: tab.icon,
      sectionLayout: tab.sectionLayout, custom: 'preserved',
    });
  });

  it('Scenario: never mutates the original and returns independent deterministic copies', () => {
    const input = legacyDashboard();
    const snapshot = JSON.stringify(input);
    freezeDeep(input);
    const result = readDashboardSections(input);
    expect(readDashboardSections(input)).toEqual(result);
    result.tabs[0].sections[0].cards[1].sensorScale = { min: 0, max: 1 };
    result.visibility.users.push('not-in-original');
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('Scenario: preserves all responsive slot profiles and their empty positions', () => {
    const input = legacyDashboard();
    input.tabs[0].sectionLayout = {
      columns1: ['section-a', null, 'empty'],
      columns2: [null, 'empty', null, 'section-a'],
      columns3: ['empty', null, null, 'section-a'],
      columns4: [null, null, 'section-a', 'empty'],
    };
    freezeDeep(input);
    const result = readDashboardSections(input);
    expect(result.tabs[0].sectionLayout).toEqual(input.tabs[0].sectionLayout);
    expect(readDashboardSections(result).tabs[0].sectionLayout).toEqual(input.tabs[0].sectionLayout);
    expect(result.tabs[0].sectionLayout?.columns2).not.toBe(input.tabs[0].sectionLayout.columns2);
  });

  it('Scenario: accepts its output without migrating twice or sharing nested data', () => {
    const first = readDashboardSections(legacyDashboard());
    first.tabs[0].maxColumns = 3;
    first.tabs[0].sections[0].cards[0].gridOptions = { columns: 5, rows: 2, minColumns: 2, maxColumns: 8, minRows: 1, maxRows: 4 };
    freezeDeep(first);
    const second = readDashboardSections(first);
    expect(second).toEqual(first);
    expect(second.tabs[0].sections[0].cards[0]).not.toBe(first.tabs[0].sections[0].cards[0]);
  });

  it('Scenario: does not discard retired or unknown card kinds during migration', () => {
    const input = legacyDashboard();
    input.tabs[0].widgets[1].config.extra = { cards: ['room', 'scene', 'system', 'future-card'].map((kind) => ({ id: kind, kind, custom: { value: 10 } })) };
    const cards = readDashboardSections(input).tabs[0].sections[0].cards;
    expect(cards.map((card) => card.kind)).toEqual(['room', 'scene', 'system', 'future-card']);
    expect(cards.every((card) => (card.custom as { value: number }).value === 10)).toBe(true);
  });

  it.each([
    ['light', 'small', 3], ['action', 'small', 3], ['sensor', 'small', 6],
    ['sensor', 'full', 6], ['media', 'small', 12], ['clock', 'medium', 12], ['clock_digital', 'small', 12],
    ['sensor', undefined, 6], ['camera', undefined, 12], ['light', undefined, 3],
  ])('Scenario: preserves historical effective width for %s with %s span', (kind, span, columns) => {
    const input = legacyDashboard();
    input.tabs[0].widgets[1].config.extra = { cards: [{ id: 'example', kind, span }] };
    expect(readDashboardSections(input).tabs[0].sections[0].cards[0].gridOptions.columns).toBe(columns);
  });

  it('Scenario: allows equal card IDs in different sections, never within one section', () => {
    const input = legacyDashboard();
    const extra = { cards: [{ id: 'shared-local-id', kind: 'sensor' }] };
    input.tabs[0].widgets[1].config.extra = extra;
    input.tabs[0].widgets[3].config.extra = extra;
    expect(readDashboardSections(input).tabs[0].sections.map((section) => section.cards[0].id)).toEqual(['shared-local-id', 'shared-local-id']);
    extra.cards.push(extra.cards[0]);
    expect(() => readDashboardSections(input)).toThrow('duplicate identity');
  });

  it.each([null, 3, {}, [{ kind: 'sensor' }], [{ id: 'bad', kind: 'sensor', span: 'unknown' }]])(
    'Scenario: rejects malformed cards rather than silently losing them (%j)', (cards) => {
      const input = legacyDashboard();
      input.tabs[0].widgets[1].config.extra = { cards };
      expect(() => readDashboardSections(input)).toThrow('Invalid dashboard layout');
    },
  );

  it('Scenario: rejects future versions without treating them as V1', () => {
    const input = { ...legacyDashboard(), layoutVersion: 3 };
    expect(() => readDashboardSections(input)).toThrow('Unsupported dashboard layout version');
  });

  it('Scenario: rejects ambiguous section or tab identities', () => {
    const input = legacyDashboard();
    input.tabs[0].widgets.push(input.tabs[0].widgets[1]);
    expect(() => readDashboardSections(input)).toThrow('duplicate identity');
    const duplicateTabs: Dashboard = { ...legacyDashboard(), tabs: [input.tabs[0], input.tabs[0]] };
    expect(() => readDashboardSections(duplicateTabs)).toThrow('duplicate identity');
  });

  it('Scenario: supports an empty dashboard and empty tabs', () => {
    expect(readDashboardSections({ ...legacyDashboard(), tabs: [] }).tabs).toEqual([]);
    const input = legacyDashboard();
    input.tabs[0].widgets = [];
    expect(readDashboardSections(input).tabs[0]).toMatchObject({ sections: [], widgets: [], legacyWidgetOrder: [], maxColumns: 4 });
  });
});

describe('Feature: Card grid bounds (AC46)', () => {
  it('Scenario: retains additional grid metadata without interpreting it', () => {
    expect(readCardGridOptions({ columns: 6, rows: 'auto', customHint: 'preserved' })).toMatchObject({ customHint: 'preserved' });
  });

  it('Scenario: accepts full width and automatic rows with optional bounds', () => {
    expect(readCardGridOptions({ columns: 'full', rows: 'auto', minColumns: 3, maxColumns: 12 })).toEqual({ columns: 'full', rows: 'auto', minColumns: 3, maxColumns: 12 });
  });

  it.each([
    { columns: 0, rows: 'auto' }, { columns: 13, rows: 'auto' }, { columns: 2.5, rows: 'auto' },
    { columns: 6, rows: 0 }, { columns: 6, rows: -1 }, { columns: 6, rows: NaN },
    { columns: 6, rows: 1.5 }, { columns: 6, rows: Infinity }, { columns: '6', rows: 'auto' },
    { columns: 6, rows: 'auto', minColumns: 8 }, { columns: 6, rows: 'auto', maxColumns: 4 },
    { columns: 'full', rows: 'auto', minColumns: 9, maxColumns: 4 },
    { columns: 6, rows: 3, maxRows: 2 }, { columns: 6, rows: 1, minRows: 2 },
    { columns: 6, rows: 'auto', minRows: 4, maxRows: 2 },
  ])('Scenario: rejects invalid or contradictory sizes (%j)', (options) => {
    expect(() => readCardGridOptions(options)).toThrow('Invalid dashboard layout');
  });
});
