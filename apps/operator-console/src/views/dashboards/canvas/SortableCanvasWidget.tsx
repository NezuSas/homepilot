import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { DASHBOARD_DRAG_TRANSITION } from '../sectionCardDrag';
import type { DashboardWidget, DashboardWidgetConfig } from '../types';
import { DashboardWidgetNode } from '../DashboardWidget';
import { clampSectionSpan, getSectionSpan } from '../dashboardUtils';
import { useMeasuredRowSpan } from './useMeasuredRowSpan';
import { useJustDropped } from './useJustDropped';

/** True when a pointer/touch landed on the section surface itself, not on an interactive control inside it. */
function isDragSurface(target: EventTarget | null, surface: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest('[data-dashboard-card-id], button, summary, input, select, textarea, a, [role="button"], [role="slider"]');
  return !control || control === surface;
}

/** Reorderable zone: reordering drags the whole widget, sizing comes from its measured height. */
export function SortableCanvasWidget({
  widget,
  columns,
  gap,
  isEditing,
  canDrag,
  isSelected,
  onClick,
  onConfigChange,
  onDelete,
  onDuplicate,
  slotMode = false,
}: {
  widget: DashboardWidget;
  columns: number;
  gap: number;
  isEditing: boolean;
  canDrag: boolean;
  isSelected: boolean;
  onClick: (id: string) => void;
  onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  slotMode?: boolean;
}) {
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: widget.id,
    data: { kind: widget.type === 'section' ? 'section' : 'widget', sectionId: widget.id, cardCount: Array.isArray(widget.config.extra?.cards) ? widget.config.extra.cards.length : 0, getPreviewRect: () => nodeRef.current?.getBoundingClientRect(), getPreviewNode: () => nodeRef.current },
    disabled: !canDrag,
    transition: DASHBOARD_DRAG_TRANSITION,
    attributes: { roleDescription: t('common.reorder_role') },
  });
  const settling = useJustDropped(isDragging);
  const span = clampSectionSpan(getSectionSpan(widget), columns);
  const sectionDrag = canDrag && widget.type === 'section';

  return (
    <div
      ref={(node) => { setNodeRef(node); nodeRef.current = node; }}
      data-dashboard-drag-origin={isDragging ? 'true' : undefined}
      data-dashboard-just-dropped={settling ? 'true' : undefined}
      data-dashboard-section-id={widget.type === 'section' ? widget.id : undefined}
      data-dashboard-drop-target={canDrag && isOver && !isDragging ? 'true' : undefined}
      {...(sectionDrag ? { ...attributes, 'aria-label': `${t('common.reorder')}: ${widget.config.appearance?.title || t('dashboard.editor.sections.untitled_section')}` } : {})}
      onMouseDown={sectionDrag ? event => { if (isDragSurface(event.target, event.currentTarget)) listeners?.onMouseDown?.(event); } : undefined}
      onTouchStart={sectionDrag ? event => { if (isDragSurface(event.target, event.currentTarget)) listeners?.onTouchStart?.(event); } : undefined}
      onKeyDown={sectionDrag ? event => { if (event.target === event.currentTarget) listeners?.onKeyDown?.(event); } : undefined}
      style={{
        gridColumn: slotMode ? undefined : `span ${span}`,
        gridRow: slotMode ? undefined : `span ${rowSpan}`,
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        "min-w-0 min-h-0 select-none relative rounded-section sm:rounded-panel lg:rounded-dashboard",
        sectionDrag && 'touch-pan-y cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-primary',
        isSelected && isEditing && widget.type !== 'section' && "z-10 ring-4 ring-primary ring-offset-4 ring-offset-background shadow-primary-ring"
      )}
    >
      <DashboardWidgetNode
        widget={widget}
        isEditing={isEditing}
        canDrag={canDrag}
        isSelected={isEditing && isSelected}
        onClick={() => { if (isEditing) onClick(widget.id); }}
        onConfigChange={onConfigChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
        columns={columns}
      />
    </div>
  );
}
