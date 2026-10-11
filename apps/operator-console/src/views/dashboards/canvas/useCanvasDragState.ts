import { useState, useRef, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { DASHBOARD_DRAG_TRANSITION } from '../sectionCardDrag';
import type { DashboardWidget } from '../types';
import type { CanvasDragLayout, CanvasDragPreview, CanvasDragSession } from './canvasTypes';
import { animateSectionRects, snapshotSectionRects } from './canvasDom';

/** State and FLIP animation bookkeeping shared by the canvas drag handlers and its renderers. */
export function useCanvasDragState(containerRef: RefObject<HTMLDivElement | null>) {
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const [cardDragIdentities, setCardDragIdentities] = useState<Record<string, string>>({});
  // Temporary layout follows the pointer; persistence happens only on drop.
  const [dragLayout, setDragLayout] = useState<CanvasDragLayout | null>(null);
  const dragSession = useRef<CanvasDragSession | null>(null);
  const previousSectionRects = useRef(new Map<string, DOMRect>());
  const sectionAnimations = useRef<Animation[]>([]);
  const [dragPreview, setDragPreview] = useState<CanvasDragPreview | null>(null);

  useLayoutEffect(() => {
    const previous = previousSectionRects.current;
    previousSectionRects.current = new Map();
    if (!previous.size || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = animateSectionRects(containerRef.current, previous, DASHBOARD_DRAG_TRANSITION);
    sectionAnimations.current = animations;
    return () => animations.forEach(animation => animation.cancel());
  }, [dragLayout, containerRef]);

  /** Remembers where every section/card is now, then stops running animations before the next layout. */
  const captureSectionRects = () => {
    previousSectionRects.current = snapshotSectionRects(containerRef.current);
    sectionAnimations.current.forEach(animation => animation.cancel());
  };

  return {
    activeWidget, setActiveWidget,
    cardDragIdentities, setCardDragIdentities,
    dragLayout, setDragLayout,
    dragPreview, setDragPreview,
    dragSession,
    captureSectionRects,
  };
}

export type CanvasDragState = ReturnType<typeof useCanvasDragState>;
