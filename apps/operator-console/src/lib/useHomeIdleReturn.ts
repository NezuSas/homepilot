import { useEffect } from 'react';

export const HOME_IDLE_RETURN_MS = 120_000;

/**
 * Calls `onIdle` after a period without user activity. An open modal dialog
 * postpones it, so work in progress is never interrupted; any interaction
 * (pointer, touch, key, wheel, trusted scroll) starts a fresh period.
 */
export function useHomeIdleReturn(enabled: boolean, onIdle: () => void, idleMs: number = HOME_IDLE_RETURN_MS): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
          schedule();
          return;
        }
        onIdle();
      }, idleMs);
    };
    const onActivity = () => schedule();
    const onScroll = (event: Event) => { if (event.isTrusted) schedule(); };
    schedule();
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [enabled, onIdle, idleMs]);
}
