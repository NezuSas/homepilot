import { pointerWithin, closestCenter, rectIntersection } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { isSectionSlotId } from './canvasLayout';

interface DroppableData {
  kind?: unknown;
  cardCount?: unknown;
}

/**
 * Cards navigate between cards/empty Sections. Sections that use the sparse
 * slot model navigate only through slot droppables; otherwise overlapping
 * Section and slot rectangles make keyboard movement collapse the order
 * instead of preserving intentional gaps.
 */
export function isKeyboardDropTarget(
  activeKind: unknown,
  useSectionSlots: boolean,
  droppableId: string,
  data: DroppableData | undefined,
): boolean {
  const isCard = activeKind === 'section-card';
  const isSectionSlotDrag = activeKind === 'section' && useSectionSlots;
  if (isCard) return data?.kind === 'section-card' || (data?.kind === 'section' && data.cardCount === 0);
  if (isSectionSlotDrag) return isSectionSlotId(droppableId);
  return data?.kind !== 'section-card';
}

/** Cards only collide with cards/sections; sections prefer slots, then any non-card target. */
export const canvasCollisionDetection: CollisionDetection = (args) => {
  const isCard = args.active.data.current?.kind === 'section-card';
  const droppableContainers = args.droppableContainers.filter((container) => isCard
    ? container.data.current?.kind === 'section-card' || container.data.current?.kind === 'section'
    : container.data.current?.kind !== 'section-card');
  if (!isCard) {
    const hits = pointerWithin({ ...args, droppableContainers });
    const slot = hits.find(hit => isSectionSlotId(String(hit.id)));
    return slot ? [slot] : hits.length ? hits : rectIntersection({ ...args, droppableContainers });
  }
  const hits = pointerWithin({ ...args, droppableContainers });
  const cardHits = hits.filter((hit) => droppableContainers.find((container) => container.id === hit.id)?.data.current?.kind === 'section-card');
  return cardHits.length ? cardHits : hits.length ? hits : args.pointerCoordinates ? [] : closestCenter({ ...args, droppableContainers });
};
