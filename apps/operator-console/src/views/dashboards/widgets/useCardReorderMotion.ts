import { useLayoutEffect, useRef, type RefObject } from 'react';

export const CARD_REORDER_MS = 240;
export const CARD_REORDER_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const MOTION_ID = 'card-reorder';

interface Box { x: number; y: number; width: number; height: number }

const cardsOf = (grid: HTMLElement) => Array.from(grid.querySelectorAll<HTMLElement>('[data-dashboard-card-id]'));
const boxOf = (element: HTMLElement, origin: DOMRect): Box => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
};
const motionOf = (element: HTMLElement) => (element.getAnimations?.() ?? []).filter((animation) => animation.id === MOTION_ID);

/**
 * When the order of a section's cards changes, each card slides from where it was to where it is now, so a
 * reorder reads as movement instead of a jump. A card caught mid-slide continues from where it is on screen.
 */
export function useCardReorderMotion(gridRef: RefObject<HTMLElement | null>, orderKey: string): void {
  const previous = useRef(new Map<string, Box>());

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const origin = grid.getBoundingClientRect();
    const next = new Map<string, Box>();

    for (const element of cardsOf(grid)) {
      const id = element.dataset.dashboardCardId;
      if (!id) continue;
      const running = motionOf(element);
      const visual = running.length ? boxOf(element, origin) : null;
      running.forEach((animation) => animation.cancel());
      const natural = boxOf(element, origin);
      next.set(id, natural);
      if (reduced || typeof element.animate !== 'function') continue;
      const from = visual ?? previous.current.get(id);
      if (!from) continue;
      if (Math.abs(from.width - natural.width) > 2 || Math.abs(from.height - natural.height) > 2) continue;
      const dx = from.x - natural.x;
      const dy = from.y - natural.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
        { duration: CARD_REORDER_MS, easing: CARD_REORDER_EASING, id: MOTION_ID },
      );
    }
    previous.current = next;
  }, [gridRef, orderKey]);

  // A resize moves every card without a reorder; remember the new places so the next reorder starts from them.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const origin = grid.getBoundingClientRect();
      const next = new Map<string, Box>();
      for (const element of cardsOf(grid)) {
        const id = element.dataset.dashboardCardId;
        if (id && motionOf(element).length === 0) next.set(id, boxOf(element, origin));
      }
      if (next.size > 0) previous.current = next;
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef]);
}
