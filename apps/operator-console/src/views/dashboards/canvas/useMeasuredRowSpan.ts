import { useState, useRef, useEffect } from 'react';
import { computeRowSpan } from './canvasLayout';

/** Measures an element's rendered height and derives a grid row-span from it. */
export function useMeasuredRowSpan(gap: number) {
  const [rowSpan, setRowSpan] = useState(1);
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      if (height > 0) {
        setRowSpan(computeRowSpan(height, gap));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gap]);

  return { nodeRef, rowSpan };
}
