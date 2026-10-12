import { useEffect, useRef, useState } from 'react';

export const JUST_DROPPED_MS = 420;

/** True for a moment after an element finishes being dragged, so it can settle into place with a short pulse. */
export function useJustDropped(isDragging: boolean): boolean {
  const [settling, setSettling] = useState(false);
  const wasDragging = useRef(false);

  useEffect(() => {
    if (isDragging) {
      wasDragging.current = true;
      setSettling(false);
      return undefined;
    }
    if (!wasDragging.current) return undefined;
    wasDragging.current = false;
    setSettling(true);
    const timer = window.setTimeout(() => setSettling(false), JUST_DROPPED_MS);
    return () => window.clearTimeout(timer);
  }, [isDragging]);

  return settling;
}
