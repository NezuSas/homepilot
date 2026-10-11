import { sectionCardDragId, type SectionCardPlacement } from '../sectionCardDrag';
import { cardPlacementFromBox, rowAtOffset } from './canvasLayout';

/** Key under which a section or card rect is remembered between drag layouts. */
function dragRectKey(node: HTMLElement): string {
  const sectionId = node.closest<HTMLElement>('[data-dashboard-section-id]')?.dataset.dashboardSectionId ?? '';
  return node.dataset.dashboardCardId ? sectionCardDragId(sectionId, node.dataset.dashboardCardId) : node.dataset.dashboardSectionId!;
}

/** Snapshots the rect of every section and card so the next layout can animate from it. */
export function snapshotSectionRects(container: HTMLElement | null): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  container?.querySelectorAll<HTMLElement>('[data-dashboard-section-id], [data-dashboard-card-id]').forEach(node => {
    rects.set(dragRectKey(node), node.getBoundingClientRect());
  });
  return rects;
}

/** Plays the FLIP animation from the previous rects to each node's current position. */
export function animateSectionRects(container: HTMLElement | null, previous: Map<string, DOMRect>, options: KeyframeAnimationOptions): Animation[] {
  const animations: Animation[] = [];
  container?.querySelectorAll<HTMLElement>('[data-dashboard-section-id], [data-dashboard-card-id]').forEach(node => {
    const section = node.closest<HTMLElement>('[data-dashboard-section-id]');
    const key = dragRectKey(node);
    const before = previous.get(key);
    if (!before || node.dataset.dashboardDragOrigin === 'true') return;
    const after = node.getBoundingClientRect();
    const parentBefore = node.dataset.dashboardCardId && section?.dataset.dashboardDragOrigin !== 'true' ? previous.get(section?.dataset.dashboardSectionId ?? '') : undefined;
    const parentAfter = parentBefore ? section?.getBoundingClientRect() : undefined;
    const x = before.left - after.left - (parentBefore && parentAfter ? parentBefore.left - parentAfter.left : 0);
    const y = before.top - after.top - (parentBefore && parentAfter ? parentBefore.top - parentAfter.top : 0);
    if (x || y) animations.push(node.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], options));
  });
  return animations;
}

/**
 * Snapshot the actual surface, not a second presenter with view-mode
 * padding/controls. Canvas instruments must keep their painted pixels.
 */
export function cloneDragPreviewNode(original: HTMLElement): HTMLElement {
  const clone = original.cloneNode(true) as HTMLElement;
  const canvases = clone.querySelectorAll('canvas');
  original.querySelectorAll('canvas').forEach((canvas, index) => canvases[index]?.getContext('2d')?.drawImage(canvas, 0, 0));
  const ids = new Map<string, string>();
  clone.querySelectorAll('[id]').forEach((node, index) => {
    const id = node.getAttribute('id');
    if (id) ids.set(id, `dashboard-drag-preview-${index}`);
  });
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      for (const [originalId, previewId] of ids) value = value.replaceAll(`url(#${originalId})`, `url(#${previewId})`);
      if (attribute.name === 'id') value = ids.get(value) ?? value;
      if ((attribute.name === 'href' || attribute.name === 'xlink:href') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
    for (const name of ['aria-describedby', 'data-dashboard-card-id', 'data-dashboard-section-id', 'data-dashboard-drag-origin', 'data-dashboard-drop-target']) node.removeAttribute(name);
  }
  Object.assign(clone.style, { width: '100%', height: '100%', gridRow: 'auto', gridColumn: 'auto', transform: 'none', transition: 'none', opacity: '1' });
  return clone;
}

/** Reads every section's card grid and returns card placements plus the drop cell inside the target section. */
export function measureCardPlacements(
  container: HTMLElement | null,
  targetSectionId: unknown,
  dragged: { left: number; top: number } | null | undefined,
): { placements: Record<string, SectionCardPlacement[]>; destination?: { column: number; row: number } } {
  const placements: Record<string, SectionCardPlacement[]> = {};
  let destination: { column: number; row: number } | undefined;
  container?.querySelectorAll<HTMLElement>('[data-dashboard-section-id]').forEach(section => {
    const id = section.dataset.dashboardSectionId;
    const grid = section.querySelector<HTMLElement>('[data-section-card-grid]');
    if (!id || !grid) return;
    const bounds = grid.getBoundingClientRect();
    const step = (bounds.width + 8) / 12;
    const tracks = getComputedStyle(grid).gridTemplateRows.split(' ').map(Number.parseFloat).filter(Number.isFinite);
    placements[id] = Array.from(grid.querySelectorAll<HTMLElement>('[data-dashboard-card-id]')).map(node =>
      cardPlacementFromBox(node.dataset.dashboardCardId!, node.getBoundingClientRect(), bounds, step, tracks));
    if (id === targetSectionId && dragged) destination = { column: Math.round((dragged.left - bounds.left) / step) + 1, row: rowAtOffset(tracks, dragged.top - bounds.top) };
  });
  return { placements, destination };
}
