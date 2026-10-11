import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../../lib/utils';
import { sectionSlotDroppableId } from './canvasLayout';
import { useMeasuredRowSpan } from './useMeasuredRowSpan';

export function SectionDropSlot({ index, columns, gap, editing, hasContent, children }: { index: number; columns: number; gap: number; editing: boolean; hasContent: boolean; children?: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionSlotDroppableId(index), disabled: !editing });
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);
  return <div
    ref={(node) => { setNodeRef(node); nodeRef.current = node; }}
    style={{ gridColumn: (index % columns) + 1, gridRow: `span ${rowSpan}` }}
    data-section-slot={index}
    className={cn('min-w-0', !hasContent && 'min-h-36', isOver && editing && 'rounded-panel outline outline-2 outline-primary/75 bg-primary/10')}
  >{children}</div>;
}
