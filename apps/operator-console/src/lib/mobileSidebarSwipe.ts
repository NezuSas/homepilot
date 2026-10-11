import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const CLOSE_SWIPE_DISTANCE = 64;

export interface SwipePoint { x: number; y: number }

/** A mostly-horizontal swipe towards the left of at least 64px closes the drawer. */
export function isCloseSwipe(start: SwipePoint, end: SwipePoint): boolean {
  const horizontal = end.x - start.x;
  const vertical = end.y - start.y;
  return horizontal <= -CLOSE_SWIPE_DISTANCE && Math.abs(horizontal) > Math.abs(vertical);
}

/** Pointer handlers for the mobile sidebar drawer: swipe left to close. */
export function useMobileSidebarSwipe(onClose: () => void) {
  const startRef = useRef<SwipePoint | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    startRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || event.pointerType !== 'touch') return;
    if (isCloseSwipe(start, { x: event.clientX, y: event.clientY })) onClose();
  }, [onClose]);

  const onPointerCancel = useCallback(() => { startRef.current = null; }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
