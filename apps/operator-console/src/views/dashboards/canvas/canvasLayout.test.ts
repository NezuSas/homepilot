import {
  cardPlacementFromBox,
  computeRowSpan,
  computeSlotCount,
  duplicateSectionWidgets,
  getCanvasGap,
  isBrokenSectionTitle,
  isSectionSlotId,
  replaceBrokenSectionTitles,
  resolveSlotTargetIndex,
  rowAtOffset,
  sectionSlotDroppableId,
} from './canvasLayout';
import type { DashboardWidget } from '../types';

function section(id: string, title: string, cards: Array<{ id: string }> = []): DashboardWidget {
  return {
    id,
    type: 'section',
    config: {
      binding: { entityType: 'system', entityId: id },
      appearance: { title },
      extra: { cards },
    },
  } as unknown as DashboardWidget;
}

describe('Feature: dashboard canvas layout helpers', () => {
  it('uses a tighter gap on single-column canvases', () => {
    expect(getCanvasGap(1)).toBe(16);
    expect(getCanvasGap(3)).toBe(20);
  });

  it('derives row spans from the measured height and never goes below one row', () => {
    expect(computeRowSpan(0, 20)).toBe(1);
    expect(computeRowSpan(8, 20)).toBe(1);
    expect(computeRowSpan(100, 20)).toBe(Math.ceil(120 / 28));
  });

  it('detects and replaces mojibake section titles only', () => {
    expect(isBrokenSectionTitle('SalÃ³n')).toBe(true);
    expect(isBrokenSectionTitle('Salon')).toBe(false);
    expect(isBrokenSectionTitle(undefined)).toBe(false);
    const [broken, fine] = replaceBrokenSectionTitles([section('a', 'SalÃ³n'), section('b', 'Kitchen')], 'New section');
    expect(broken.config.appearance?.title).toBe('New section');
    expect(fine.config.appearance?.title).toBe('Kitchen');
  });

  it('duplicates a section after the original with fresh ids and rebound system entity', () => {
    let counter = 0;
    const widgets = [section('a', 'A', [{ id: 'c1' }]), section('b', 'B')];
    const result = duplicateSectionWidgets(widgets, 'a', () => `new-${++counter}`);
    expect(result?.map(widget => widget.id)).toEqual(['a', 'new-1', 'b']);
    expect(result?.[1].config.binding.entityId).toBe('new-1');
    expect(result?.[1].config.extra?.cards).toEqual([{ id: 'new-2' }]);
    expect(widgets[0].config.extra?.cards).toEqual([{ id: 'c1' }]);
    expect(duplicateSectionWidgets(widgets, 'missing', () => 'x')).toBeNull();
  });

  it('computes whole-row slot counts with a spare row while dragging a section', () => {
    const base = { useSectionSlots: true, slotsLength: 5, editingFloor: 0, columns: 3, draggingSection: false };
    expect(computeSlotCount(base)).toBe(6);
    expect(computeSlotCount({ ...base, editingFloor: 8 })).toBe(9);
    expect(computeSlotCount({ ...base, draggingSection: true })).toBe(9);
    expect(computeSlotCount({ ...base, useSectionSlots: false })).toBe(0);
  });

  it('resolves slot targets from slot ids or occupying section ids', () => {
    expect(sectionSlotDroppableId(4)).toBe('section-slot-4');
    expect(isSectionSlotId('section-slot-4')).toBe(true);
    expect(isSectionSlotId('abc')).toBe(false);
    expect(resolveSlotTargetIndex('section-slot-4', ['a'])).toBe(4);
    expect(resolveSlotTargetIndex('b', ['a', 'b'])).toBe(1);
    expect(resolveSlotTargetIndex('zzz', ['a'])).toBe(-1);
  });

  it('maps vertical offsets onto card grid rows, extending past the measured tracks', () => {
    const tracks = [20, 20];
    expect(rowAtOffset(tracks, 0)).toBe(1);
    expect(rowAtOffset(tracks, 23)).toBe(1);
    expect(rowAtOffset(tracks, 24)).toBe(2);
    expect(rowAtOffset(tracks, 100)).toBeGreaterThan(2);
    expect(rowAtOffset([], 0)).toBe(1);
  });

  it('maps a card box onto the 12-column grid', () => {
    const step = (1200 + 8) / 12;
    const placement = cardPlacementFromBox('c', { left: 100 + step * 2, top: 0, width: step * 3 - 8, bottom: 20 }, { left: 100, top: 0 }, step, [20]);
    expect(placement).toEqual({ id: 'c', column: 3, row: 1, columns: 3, rows: 1 });
  });
});
