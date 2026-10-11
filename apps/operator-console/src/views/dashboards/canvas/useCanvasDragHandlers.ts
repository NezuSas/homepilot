import { isValidElement } from 'react';
import type { RefObject } from 'react';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { moveSectionCard, placeSectionCard, sectionCardDragId, sectionHasPinnedCards } from '../sectionCardDrag';
import { moveSectionSlot, resolveSectionSlots, sectionLayoutKey, type SectionLayout } from '../sectionSlots';
import type { DashboardWidget } from '../types';
import { resolveSlotTargetIndex } from './canvasLayout';
import { cloneDragPreviewNode, measureCardPlacements } from './canvasDom';
import type { CanvasDragState } from './useCanvasDragState';
import type { CanvasModel } from './useCanvasModel';

interface CanvasDragHandlersInput {
  canEditLayout: boolean;
  widgets: DashboardWidget[];
  sectionLayout?: SectionLayout;
  columns: number;
  containerRef: RefObject<HTMLDivElement | null>;
  drag: CanvasDragState;
  model: Pick<CanvasModel, 'flowWidgets' | 'titleWidget' | 'sectionSlots' | 'sectionById' | 'useSectionSlots'>;
  onLayoutChange: (widgets: DashboardWidget[], sectionLayout?: SectionLayout) => void;
}

/** dnd-kit lifecycle handlers: start builds the preview, over previews the layout, end/cancel commit or restore. */
export function useCanvasDragHandlers({ canEditLayout, widgets, sectionLayout, columns, containerRef, drag, model, onLayoutChange }: CanvasDragHandlersInput) {
  const {
    cardDragIdentities, setCardDragIdentities, setActiveWidget, setDragLayout, setDragPreview, dragSession, captureSectionRects,
  } = drag;
  const { flowWidgets, titleWidget, sectionSlots, sectionById, useSectionSlots } = model;

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditLayout) return;
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
    dragSession.current = { widgets, layout: sectionLayout, sourceSectionId: event.active.data.current?.sectionId, identities: cardDragIdentities };
    const widget = flowWidgets.find((w) => w.id === event.active.id);
    if (widget) setActiveWidget(widget);
    const getPreviewRect = event.active.data.current?.getPreviewRect;
    const rect = event.active.rect.current.initial ?? (typeof getPreviewRect === 'function' ? getPreviewRect() : null);
    const getPreviewNode = event.active.data.current?.getPreviewNode;
    const original = typeof getPreviewNode === 'function' ? getPreviewNode() : null;
    const clone = original instanceof HTMLElement ? cloneDragPreviewNode(original) : undefined;
    if (rect) setDragPreview({ width: rect.width, height: rect.height,
      node: clone, radius: original instanceof HTMLElement ? getComputedStyle(original).borderRadius : undefined,
      content: isValidElement(event.active.data.current?.preview) ? event.active.data.current.preview : undefined });
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const session = dragSession.current;
    if (!session || !over || active.id === over.id || session.lastTarget === String(over.id)) return;
    const source = active.data.current;
    const destination = over.data.current;
    if (source?.kind === 'section-card' && typeof source.cardId === 'string' && session.sourceSectionId
      && typeof destination?.sectionId === 'string'
      && (destination.sectionId !== session.sourceSectionId || destination.kind === 'section-card')) {
      const moved = moveSectionCard(session.widgets, session.sourceSectionId, source.cardId, destination.sectionId, destination.kind === 'section-card' ? destination.cardId : undefined);
      if (moved === session.widgets) return;
      const sourceKey = sectionCardDragId(session.sourceSectionId, source.cardId);
      const targetKey = sectionCardDragId(destination.sectionId, source.cardId);
      if (destination.sectionId !== session.sourceSectionId) setCardDragIdentities(current => {
        const next = { ...current, [targetKey]: current[sourceKey] ?? String(active.id) };
        delete next[sourceKey];
        return next;
      });
      session.widgets = moved;
      session.sourceSectionId = destination.sectionId;
    } else if (source?.kind === 'section' && useSectionSlots) {
      // Each preview starts from the saved slot map, not previous hover swaps.
      const slots = resolveSectionSlots(widgets, sectionLayout, columns);
      const moved = moveSectionSlot(slots, String(active.id), resolveSlotTargetIndex(String(over.id), slots));
      if (moved === slots) return;
      session.layout = { ...session.layout, [sectionLayoutKey(columns)]: moved };
    } else if (source?.kind === 'section' && over.data.current?.kind === 'section') {
      const from = widgets.findIndex(widget => widget.id === active.id);
      const to = widgets.findIndex(widget => widget.id === over.id);
      if (from < 0 || to < 0 || from === to) return;
      session.widgets = arrayMove(widgets, from, to);
      const reordered = session.widgets.filter(widget => widget.type === 'section').map(widget => widget.id);
      let index = 0;
      const oldSlots = resolveSectionSlots(widgets, sectionLayout, columns);
      session.layout = { ...session.layout, [sectionLayoutKey(columns)]: oldSlots.map(id => id === null ? null : reordered[index++] ?? null) };
    } else return;
    session.lastTarget = String(over.id);
    captureSectionRects();
    setDragLayout({ widgets: session.widgets, layout: session.layout });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    setDragPreview(null);
    const session = dragSession.current;
    dragSession.current = null;
    setDragLayout(null);
    if (!canEditLayout) return;

    const { active, over } = event;
    if (!over) {
      if (session) setCardDragIdentities(session.identities);
      return;
    }
    const overData = over.data.current;
    const overCard = overData?.kind === 'section-card';
    // A card dropped on another card keeps exactly the order shown during the drag, unless that
    // section pins its cards to grid positions, where the pointer position decides.
    const keepsPreviewedOrder = overCard && Boolean(session?.lastTarget)
      && !sectionHasPinnedCards(session?.widgets ?? widgets, overData?.sectionId);
    if (!keepsPreviewedOrder && overData && active.data.current?.kind === 'section-card' && (overData.kind === 'section' || overCard)) {
      const sourceId = session?.sourceSectionId ?? active.data.current.sectionId;
      const targetId = overData.sectionId;
      const cardId = active.data.current.cardId;
      const { placements, destination } = measureCardPlacements(containerRef.current, targetId, active.rect.current.translated);
      if (typeof sourceId === 'string' && typeof targetId === 'string' && typeof cardId === 'string' && destination) {
        const placed = placeSectionCard(session?.widgets ?? widgets, sourceId, cardId, targetId, destination.column, destination.row, placements);
        onLayoutChange(placed, session?.layout ?? sectionLayout);
        return;
      }
    }
    // A cross-section/slot preview is already at its destination. Do not swap
    // it back when the pointer ends over the relocated ghost itself.
    if (session?.lastTarget) {
      onLayoutChange(session.widgets, session.layout);
      return;
    }
    if (active.id === over.id) return;
    const source = active.data.current;
    const destination = over.data.current;
    if (source?.kind === 'section-card') {
      if (typeof source.sectionId !== 'string' || typeof source.cardId !== 'string' || typeof destination?.sectionId !== 'string') return;
      const moved = moveSectionCard(widgets, source.sectionId, source.cardId, destination.sectionId, destination.kind === 'section-card' ? destination.cardId : undefined);
      if (moved !== widgets) {
        if (source.sectionId !== destination.sectionId) {
          const sourceKey = sectionCardDragId(source.sectionId, source.cardId);
          const targetKey = sectionCardDragId(destination.sectionId, source.cardId);
          // Preserve the active registration at its new node for drop motion.
          setCardDragIdentities(current => {
            const next = { ...current, [targetKey]: current[sourceKey] ?? sourceKey };
            delete next[sourceKey];
            return next;
          });
        }
        onLayoutChange(moved, sectionLayout);
      }
      return;
    }

    if (useSectionSlots && sectionById.has(String(active.id))) {
      const targetIndex = resolveSlotTargetIndex(String(over.id), sectionSlots);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) return;
      const moved = moveSectionSlot(sectionSlots, String(active.id), targetIndex);
      if (moved === sectionSlots) return;
      onLayoutChange(widgets, { ...sectionLayout, [sectionLayoutKey(columns)]: moved });
      return;
    }

    const oldIndex = flowWidgets.findIndex((w) => w.id === active.id);
    const newIndex = flowWidgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedFlow = arrayMove(flowWidgets, oldIndex, newIndex);
    const reordered = titleWidget ? [titleWidget, ...reorderedFlow] : reorderedFlow;
    onLayoutChange(reordered);
  };

  const handleDragCancel = () => {
    setActiveWidget(null);
    setDragPreview(null);
    if (dragSession.current) setCardDragIdentities(dragSession.current.identities);
    dragSession.current = null;
    setDragLayout(null);
  };

  return { handleDragStart, handleDragOver, handleDragEnd, handleDragCancel };
}
