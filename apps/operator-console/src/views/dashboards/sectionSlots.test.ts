import { availableSectionSlot, moveSectionSlot, resolveSectionSlots, sectionLayoutKey } from './sectionSlots';
import type { DashboardWidget } from './types';

const widgets = ['a', 'b', 'c'].map((id) => ({ id, type: 'section', config: {} })) as DashboardWidget[];

describe('Feature: independent responsive Section slots', () => {
  it('derives contiguous slots for a historical dashboard at every column count', () => {
    for (const columns of [1, 2, 3, 4]) expect(resolveSectionSlots(widgets, undefined, columns)).toEqual(['a', 'b', 'c']);
  });

  it('moves into an empty slot without compaction and swaps occupied slots', () => {
    expect(moveSectionSlot(['a', 'b', 'c'], 'b', 4)).toEqual(['a', null, 'c', null, 'b']);
    expect(moveSectionSlot(['a', 'b', 'c'], 'b', 2)).toEqual(['a', 'c', 'b']);
  });

  it('keeps each responsive profile independent and appends newly added sections', () => {
    const layout = { columns4: ['a', null, 'b', 'c'], columns3: ['a', 'c', 'b'] };
    expect(resolveSectionSlots(widgets, layout, 4)).toEqual(['a', null, 'b', 'c']);
    expect(resolveSectionSlots(widgets, layout, 3)).toEqual(['a', 'c', 'b']);
    expect(resolveSectionSlots(widgets, layout, 2)).toEqual(['a', 'b', 'c']);
    expect(sectionLayoutKey(1)).toBe('columns1');
    expect(resolveSectionSlots([...widgets, { ...widgets[0], id: 'd' }], layout, 4)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('ignores deleted or duplicated IDs without losing valid gaps', () => {
    expect(resolveSectionSlots(widgets, { columns3: ['a', 'missing', 'a', null, 'c'] }, 3)).toEqual(['a', 'b', null, null, 'c']);
  });
  it('places Add Section in the first available slot after moving and reloading without compacting existing sections', () => {
    const moved = moveSectionSlot(['a', 'b', 'c'], 'a', 5);
    const reloaded = resolveSectionSlots(widgets, { columns3: moved }, 3);
    expect(availableSectionSlot(reloaded)).toBe(0);
    expect(reloaded).toEqual([null, 'b', 'c', null, null, 'a']);
    expect(availableSectionSlot(['a', 'b', 'c'])).toBe(3);
  });
});
