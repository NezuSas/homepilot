import { moveSectionCard, sectionCardDragId } from './sectionCardDrag';
import type { DashboardWidget } from './types';

const section = (id: string, cards: Array<Record<string, unknown>>): DashboardWidget => ({
  id, type: 'section', config: { layout: { x: 0, y: 0, w: 1, h: 4 }, binding: { entityId: id, entityType: 'system' }, visibility: { rules: [], defaultState: 'show' }, appearance: {}, extra: { marker: id, cards } },
});

describe('moving cards within one tab', () => {
  it('keeps the moved runtime identity while separating equal card IDs in other sections', () => {
    const original = sectionCardDragId('tech', 'card');
    const destination = sectionCardDragId('patio', 'card');
    expect(sectionCardDragId('patio', 'card', { [destination]: original })).toBe(original);
    expect(sectionCardDragId('other', 'card', { [destination]: original })).not.toBe(original);
  });
  const card = { id: 'media', kind: 'media', mediaVariant: 'classic', entityId: 'speaker', span: 'full', customMetadata: { preserve: true } };
  it('updates both sections together without losing binding, variant, metadata or unrelated cards', () => {
    const widgets = [section('tech', [card]), section('patio', [{ id: 'other' }])];
    const moved = moveSectionCard(widgets, 'tech', 'media', 'patio', 'other');
    expect(moved[0].config.extra?.cards).toEqual([]);
    expect(moved[1].config.extra).toEqual({ marker: 'patio', cards: [card, { id: 'other' }] });
    expect(widgets[0].config.extra?.cards).toEqual([card]);
  });
  it('accepts an empty destination and can reorder in the same section', () => {
    const widgets = [section('tech', [card, { id: 'second' }]), section('empty', [])];
    expect(moveSectionCard(widgets, 'tech', 'media', 'empty')[1].config.extra?.cards).toEqual([card]);
    expect(moveSectionCard(widgets, 'tech', 'media', 'tech', 'second')[0].config.extra?.cards).toEqual([{ id: 'second' }, card]);
    expect(moveSectionCard(widgets, 'tech', 'media', 'tech')[0].config.extra?.cards).toEqual([{ id: 'second' }, card]);
  });
  it('does not duplicate a card or mutate absent/cancelled targets', () => {
    const widgets = [section('tech', [card]), section('duplicate', [card])];
    expect(moveSectionCard(widgets, 'tech', 'media', 'duplicate')).toBe(widgets);
    expect(moveSectionCard(widgets, 'tech', 'missing', 'duplicate')).toBe(widgets);
    expect(moveSectionCard(widgets, 'tech', 'media', 'absent')).toBe(widgets);
  });
  it('previews repeated same-section movement before an atomic cross-section drop', () => {
    const widgets = [section('tech', [card, { id: 'second' }, { id: 'third' }]), section('patio', [])];
    const preview = moveSectionCard(widgets, 'tech', 'media', 'tech', 'third');
    expect(preview[0].config.extra?.cards).toEqual([{ id: 'second' }, { id: 'third' }, card]);
    const destination = moveSectionCard(preview, 'tech', 'media', 'patio');
    expect(destination[1].config.extra?.cards).toEqual([card]);
    expect(widgets[0].config.extra?.cards).toEqual([card, { id: 'second' }, { id: 'third' }]);
  });
});
