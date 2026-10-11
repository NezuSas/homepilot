import {
  applyDraftToCard,
  createCardFromCatalogItem,
  createDraftFromCard,
  createDraftFromNewCard,
  filterCatalogItems,
  getBoundRoutineIcon,
  type SectionCatalogItem,
} from './sectionCardEditing';
import type { NormalizedSectionCardItem } from './sectionCardCatalog';

jest.mock('../../../config', () => ({ API_BASE_URL: '' }));

const item = (overrides: Partial<SectionCatalogItem>): SectionCatalogItem => ({
  kind: 'light', title: 'Button', description: 'Toggle a light', widgetType: 'device_control' as SectionCatalogItem['widgetType'], span: 'small', icon: 'lightbulb', ...overrides,
});

describe('section card editing helpers', () => {
  it('filters the catalog by category and free text', () => {
    const items = [item({}), item({ kind: 'sensor', title: 'Sensor', description: 'Reads values', span: 'medium' })];
    expect(filterCatalogItems(items, null, '')).toHaveLength(2);
    expect(filterCatalogItems(items, 'info', '').map(entry => entry.kind)).toEqual(['sensor']);
    expect(filterCatalogItems(items, null, '  TOGGLE ').map(entry => entry.kind)).toEqual(['light']);
    expect(filterCatalogItems(items, 'clock', '')).toEqual([]);
  });

  it('seeds new cards with the grid footprint that matches their default span', () => {
    expect(createCardFromCatalogItem(item({}), 'a').gridOptions).toEqual({ columns: 3, rows: 2 });
    expect(createCardFromCatalogItem(item({ kind: 'cover', span: 'medium' }), 'b').gridOptions).toEqual({ columns: 6, rows: 2 });
    expect(createCardFromCatalogItem(item({ kind: 'camera', span: 'full' }), 'c').gridOptions).toBeUndefined();
    expect(createCardFromCatalogItem(item({ kind: 'clock_premium', span: 'full' }), 'd').gridOptions).toBeUndefined();
    expect(createCardFromCatalogItem(item({ kind: 'media', span: 'full' }), 'e').mediaVariant).toBe('premium');
    expect(createCardFromCatalogItem(item({ kind: 'sensor', span: 'medium' }), 'f').visualStyle).toBe('auto');
  });

  it('builds editor drafts from new and persisted cards', () => {
    const fresh = createCardFromCatalogItem(item({ kind: 'sensor', span: 'medium' }), 'f');
    expect(createDraftFromNewCard(fresh)).toMatchObject({ entityId: '', kind: 'sensor', visualStyle: 'auto', span: 'medium' });
    const persisted: NormalizedSectionCardItem = { id: 'p', kind: 'sensor', title: 'T', entityId: 'dev', sensorScale: { min: 1, max: 5 }, sensorDecimals: true, hidden: true };
    expect(createDraftFromCard(persisted)).toMatchObject({ entityId: 'dev', sensorMin: 1, sensorMax: 5, sensorDecimals: true, visualStyle: 'gauge', hidden: true, span: 'medium' });
  });

  it('applies a draft and drops options the kind does not use', () => {
    const card: NormalizedSectionCardItem = { id: 'p', kind: 'media', title: 'Old', mediaVariant: 'classic', sensorScale: { min: 0, max: 1 }, sensorDecimals: true, visualStyle: 'gauge' };
    const labels = { fallbackTitle: 'Fallback', description: 'Desc', entityName: 'Living' };
    const light = applyDraftToCard(card, { title: '  ', kind: 'light', entityId: 'x', span: 'small', icon: 'bulb', mediaVariant: 'premium' }, undefined, labels);
    expect(light).toMatchObject({ title: 'Fallback', description: 'Desc', entityId: 'x', entityName: 'Living', widgetType: 'device_control', span: 'small', icon: 'bulb' });
    expect(light).not.toHaveProperty('mediaVariant');
    expect(light).not.toHaveProperty('sensorScale');
    expect(light).not.toHaveProperty('sensorDecimals');
    expect(light).not.toHaveProperty('visualStyle');

    const sensor = applyDraftToCard(card, { title: 'Temp', kind: 'sensor', entityId: '', span: 'small', icon: 'i', mediaVariant: 'premium', sensorDecimals: true, gridOptions: { columns: 2, rows: 'auto' } }, { min: 0, max: 10 }, labels);
    expect(sensor).toMatchObject({ title: 'Temp', entityId: undefined, span: 'medium', sensorScale: { min: 0, max: 10 }, sensorDecimals: true, visualStyle: 'gauge' });
    expect(sensor.gridOptions).toMatchObject({ columns: 4, rows: 'auto', minColumns: 4, minRows: 4 });
  });

  it('resolves the icon of the routine bound to an action card', () => {
    const scenes = [{ id: 's1', name: 'Movie' }, { id: 's2', name: 'Night', icon: 'mdi:moon' }];
    const automations = [{ id: 'a1', name: 'Auto', enabled: true }];
    expect(getBoundRoutineIcon(undefined, scenes, automations)).toBeUndefined();
    expect(getBoundRoutineIcon('s1', scenes, automations)).toBe('mdi:auto-fix');
    expect(getBoundRoutineIcon('s2', scenes, automations)).toBe('mdi:moon');
    expect(getBoundRoutineIcon('automation:a1', scenes, automations)).toBe('mdi:robot');
    expect(getBoundRoutineIcon('missing', scenes, automations)).toBeUndefined();
  });
});
