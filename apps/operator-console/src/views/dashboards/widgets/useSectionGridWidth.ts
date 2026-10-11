import { useEffect, useRef, useState } from 'react';

/** Tracks the inner content width of a section's card grid so editor previews can mirror real card sizes. */
export function useSectionGridWidth() {
  const sectionGridRef = useRef<HTMLDivElement>(null);
  const [sectionGridWidth, setSectionGridWidth] = useState(0);
  useEffect(() => {
    const grid = sectionGridRef.current;
    if (!grid) return;
    const style = getComputedStyle(grid);
    setSectionGridWidth(grid.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSectionGridWidth(entry.contentRect.width);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  return { sectionGridRef, sectionGridWidth };
}
