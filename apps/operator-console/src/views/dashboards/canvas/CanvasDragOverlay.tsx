import { createPortal } from 'react-dom';
import { DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SectionCardDragContext, DASHBOARD_DRAG_TRANSITION } from '../sectionCardDrag';
import type { DashboardWidget } from '../types';
import { WidgetContent } from '../DashboardWidget';
import type { CanvasDragPreview } from './canvasTypes';

/** Floating copy of the dragged section/card, rendered in a body portal. */
export function CanvasDragOverlay({ canEditLayout, dragPreview, activeWidget }: {
  canEditLayout: boolean;
  dragPreview: CanvasDragPreview | null;
  activeWidget: DashboardWidget | null;
}) {
  return createPortal(<DragOverlay zIndex={60} style={{ pointerEvents: 'none' }} dropAnimation={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : {
    duration: DASHBOARD_DRAG_TRANSITION.duration,
    easing: DASHBOARD_DRAG_TRANSITION.easing,
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  }}>
    {canEditLayout && dragPreview ? (
      <div
        aria-hidden="true"
        inert
        data-dashboard-drag-preview="true"
        className="pointer-events-none grid cursor-grabbing shadow-depth-3"
        style={{
          width: dragPreview.width, height: dragPreview.height, borderRadius: dragPreview.radius, containerType: 'inline-size',
        }}
      >
        {dragPreview.node ? <div className="h-full min-h-0" ref={node => { if (node && dragPreview.node) node.replaceChildren(dragPreview.node); }} /> : dragPreview.content ?? (activeWidget && <SectionCardDragContext.Provider value={false}><WidgetContent
          widget={activeWidget}
          isEditing={false}
          onClick={() => {}}
        /></SectionCardDragContext.Provider>)}
      </div>
    ) : null}
  </DragOverlay>, document.body);
}
