import { useCallback, useEffect, useRef, useState } from 'react';

export const MASONRY_ROW_UNIT_PX = 20;
export const MASONRY_ROW_GAP_PX = 8;

export function useMasonryRowSpans() {
  const [rowSpans, setRowSpans] = useState<Record<string, number>>({});
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const registerCard = useCallback((cardId: string, element: HTMLElement | null) => {
    if (!element || typeof ResizeObserver === 'undefined') return;

    if (observerRef.current === null) {
      observerRef.current = new ResizeObserver((entries) => {
        setRowSpans((previous) => {
          let changed = false;
          const next = { ...previous };

          for (const entry of entries) {
            const observedCardId = (entry.target as HTMLElement).dataset.cardId;
            if (!observedCardId) continue;

            const span = Math.max(
              1,
              Math.ceil((entry.contentRect.height + MASONRY_ROW_GAP_PX) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX)),
            );
            if (next[observedCardId] !== span) {
              next[observedCardId] = span;
              changed = true;
            }
          }

          return changed ? next : previous;
        });
      });
    }

    element.dataset.cardId = cardId;
    observerRef.current.observe(element);
  }, []);

  return { rowSpans, registerCard };
}
