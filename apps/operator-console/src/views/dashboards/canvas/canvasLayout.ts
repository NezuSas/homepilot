import type { DashboardWidget } from '../types';
import type { SectionCardPlacement } from '../sectionCardDrag';

// Fine row unit used to measure each zone's real height (Home Assistant style
// masonry: every item declares its own row-span instead of stretching to the
// tallest sibling in its row).
export const CANVAS_ROW_UNIT = 8;

export function getCanvasGap(columns: number): number {
  return columns === 1 ? 16 : 20;
}

/** Grid row-span needed by an element of the given rendered height. */
export function computeRowSpan(height: number, gap: number): number {
  return Math.max(1, Math.ceil((height + gap) / (CANVAS_ROW_UNIT + gap)));
}

/** Detects section titles that were saved with mojibake (UTF-8 read as Latin-1). */
export function isBrokenSectionTitle(value: unknown): boolean {
  return typeof value === 'string' && /[ÃÂâÆ€]/.test(value);
}

/** Replaces corrupted section titles with a readable fallback. */
export function replaceBrokenSectionTitles(widgets: DashboardWidget[], fallbackTitle: string): DashboardWidget[] {
  return widgets.map((widget) => {
    if (widget.type !== 'section') return widget;
    if (!isBrokenSectionTitle(widget.config.appearance?.title)) return widget;

    return {
      ...widget,
      config: {
        ...widget.config,
        appearance: {
          ...widget.config.appearance,
          title: fallbackTitle,
        },
      },
    };
  });
}

/** Clones a section (fresh ids for it and its cards) right after the original. */
export function duplicateSectionWidgets(widgets: DashboardWidget[], id: string, makeId: () => string): DashboardWidget[] | null {
  const source = widgets.find(widget => widget.id === id && widget.type === 'section');
  if (!source) return null;
  const duplicate = structuredClone(source);
  duplicate.id = makeId();
  if (duplicate.config.binding.entityType === 'system' && duplicate.config.binding.entityId === source.id) duplicate.config.binding.entityId = duplicate.id;
  const cards = duplicate.config.extra?.cards;
  if (Array.isArray(cards)) duplicate.config.extra = { ...duplicate.config.extra, cards: cards.map((card: unknown) => card && typeof card === 'object' ? { ...card, id: makeId() } : card) };
  const index = widgets.findIndex(widget => widget.id === id);
  return [...widgets.slice(0, index + 1), duplicate, ...widgets.slice(index + 1)];
}

/** Number of droppable slots rendered: whole rows, plus one spare row while a section is dragged. */
export function computeSlotCount(input: {
  useSectionSlots: boolean;
  slotsLength: number;
  editingFloor: number;
  columns: number;
  draggingSection: boolean;
}): number {
  if (!input.useSectionSlots) return 0;
  return Math.ceil(Math.max(input.slotsLength, input.editingFloor) / input.columns) * input.columns + (input.draggingSection ? input.columns : 0);
}

const SECTION_SLOT_PREFIX = 'section-slot-';

export function sectionSlotDroppableId(index: number): string {
  return `${SECTION_SLOT_PREFIX}${index}`;
}

export function isSectionSlotId(id: string): boolean {
  return id.startsWith(SECTION_SLOT_PREFIX);
}

/** Slot index addressed by a droppable id (a slot id, or the id of the section occupying a slot). */
export function resolveSlotTargetIndex(target: string, slots: Array<string | null>): number {
  return isSectionSlotId(target) ? Number(target.slice(SECTION_SLOT_PREFIX.length)) : slots.indexOf(target);
}

/** Card-grid row (1-based) under a vertical offset, given the measured row tracks. */
export function rowAtOffset(tracks: number[], y: number): number {
  let offset = 0;
  for (let index = 0; index < tracks.length; index++) {
    if (y < offset + tracks[index] + 4) return index + 1;
    offset += tracks[index] + 8;
  }
  return tracks.length + Math.max(1, Math.floor((y - offset) / 28) + 1);
}

interface PlacementBox { left: number; top: number; width: number; bottom: number }

/** Maps a card's rendered box onto the 12-column section card grid. */
export function cardPlacementFromBox(
  id: string,
  box: PlacementBox,
  grid: { left: number; top: number },
  step: number,
  tracks: number[],
): SectionCardPlacement {
  const row = rowAtOffset(tracks, box.top - grid.top);
  return {
    id,
    column: Math.max(1, Math.round((box.left - grid.left) / step) + 1),
    row,
    columns: Math.max(1, Math.min(12, Math.round((box.width + 8) / step))),
    rows: Math.max(1, rowAtOffset(tracks, box.bottom - grid.top - 1) - row + 1),
  };
}
