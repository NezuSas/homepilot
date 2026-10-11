import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import {
  buildSectionCatalogItems,
  reorderSectionCards,
  resolveAssignableDevices,
  resolveSectionPlacedRows,
  resolveSelectedDraftEntities,
} from './sectionWidgetModel';
import type { NormalizedSectionCardItem } from './sectionCardCatalog';

jest.mock('../../../config', () => ({ API_BASE_URL: '' }));

const device = (id: string, overrides: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id, homeId: 'h', roomId: 'r', name: id, type: 'light', status: 'ASSIGNED', lastKnownState: null, ...overrides,
});

describe('section widget model', () => {
  it('offers badge-row kinds or the non-info catalog', () => {
    const badge = buildSectionCatalogItems(true, (kind) => `T:${kind}`, (kind) => `D:${kind}`);
    expect(badge.map((item) => item.kind)).toEqual(['info_time', 'info_weather', 'info_sensor']);
    expect(badge[0]).toMatchObject({ title: 'T:info_time', description: 'D:info_time' });
    const regular = buildSectionCatalogItems(false, (kind) => kind, (kind) => kind);
    expect(regular.length).toBeGreaterThan(0);
    expect(regular.some((item) => item.kind.startsWith('info_'))).toBe(false);
  });

  it('keeps unrelated kinds restricted and sorts the shared light and action pool', () => {
    const lights = [device('b', { name: 'Beta' }), device('a', { name: 'Alpha' })];
    expect(resolveAssignableDevices('light', lights).map((item) => item.id)).toEqual(['a', 'b']);
    expect(resolveAssignableDevices('camera', lights)).toEqual([]);
  });

  it('projects placed rows only for visible, explicitly placed cards', () => {
    const cards: NormalizedSectionCardItem[] = [
      { id: 'a', kind: 'light', title: 'A', gridOptions: { columnStart: 1, rowStart: 1, columns: 3, rows: 1 } },
      { id: 'b', kind: 'light', title: 'B', gridOptions: { columnStart: 1, rowStart: 2, columns: 3, rows: 1 } },
      { id: 'c', kind: 'light', title: 'C', hidden: true, gridOptions: { columnStart: 4, rowStart: 1, columns: 3, rows: 1 } },
      { id: 'd', kind: 'light', title: 'D' },
    ];
    expect(resolveSectionPlacedRows(cards, false, { a: 3 })).toEqual({ a: 1, b: 4 });
    expect(Object.keys(resolveSectionPlacedRows(cards, true, {}))).toEqual(['a', 'b', 'c']);
  });

  it('reorders cards by id and ignores no-op moves', () => {
    const cards: NormalizedSectionCardItem[] = ['a', 'b', 'c'].map((id) => ({ id, kind: 'light', title: id }));
    expect(reorderSectionCards(cards, 'a', 'c')?.map((card) => card.id)).toEqual(['b', 'c', 'a']);
    expect(reorderSectionCards(cards, 'a', 'a')).toBeNull();
    expect(reorderSectionCards(cards, 'a', 'missing')).toBeNull();
  });

  it('resolves the entity bound to a draft across every source', () => {
    const sources = {
      devices: [device('dev')],
      scenes: [{ id: 'scene-1', name: 'Scene' }],
      automations: [{ id: 'auto-1', name: 'Auto', enabled: true }],
      displayActions: [{ deviceId: 'dev', actionKey: 'press', displayName: 'Press', deviceName: 'Dev' }],
      rooms: [{ id: 'room-1', name: 'Room', homeId: 'h' }],
    };
    expect(resolveSelectedDraftEntities({ ...sources, entityId: 'dev' }).device?.id).toBe('dev');
    expect(resolveSelectedDraftEntities({ ...sources, entityId: 'scene-1' }).scene?.name).toBe('Scene');
    expect(resolveSelectedDraftEntities({ ...sources, entityId: 'automation:auto-1' }).automation?.name).toBe('Auto');
    expect(resolveSelectedDraftEntities({ ...sources, entityId: 'device-action:dev:press' }).displayAction?.displayName).toBe('Press');
    expect(resolveSelectedDraftEntities({ ...sources, entityId: 'room-1' }).room?.name).toBe('Room');
    expect(resolveSelectedDraftEntities({ ...sources, entityId: '' })).toEqual({
      device: undefined, scene: undefined, automation: undefined, displayAction: undefined, room: undefined,
    });
  });
});
