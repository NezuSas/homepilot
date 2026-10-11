import { useState, useMemo, useRef, useEffect } from 'react';
import { getDashboardSectionColumnsForViewport, isPortraitKioskViewport } from '../dashboardUtils';
import { getCanvasGap } from './canvasLayout';

/** Tracks the canvas container and viewport size and derives the responsive grid metrics. */
export function useCanvasViewport(maxColumns: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const columns = useMemo(
    () => Math.min(maxColumns, getDashboardSectionColumnsForViewport(containerWidth, viewportSize.width, viewportSize.height)),
    [maxColumns, containerWidth, viewportSize.height, viewportSize.width],
  );
  const isPortraitKiosk = isPortraitKioskViewport(viewportSize.width, viewportSize.height);
  const gap = getCanvasGap(columns);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  return { containerRef, columns, gap, isPortraitKiosk };
}
