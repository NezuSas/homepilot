import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  closestCenter,
  rectIntersection,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SectionCardDragContext, moveSectionCard } from './sectionCardDrag';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useMemo, useRef, useEffect, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { moveSectionSlot, resolveSectionSlots, sectionLayoutKey, type SectionLayout } from './sectionSlots';
import { Button } from '../../components/ui/Button';
import ConfirmModal from '../../components/ConfirmModal';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { DashboardWidgetNode, WidgetContent } from './DashboardWidget';
import {
  clampSectionSpan,
  getDashboardSectionColumnsForViewport,
  getSectionSpan,
  isPortraitKioskViewport,
  sanitizeWidget,
} from './dashboardUtils';

interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  isEditing: boolean;
  onWidgetClick: (id: string) => void;
  selectedWidgetId: string | null;
  sectionLayout?: SectionLayout;
  onLayoutChange: (widgets: DashboardWidget[], sectionLayout?: SectionLayout) => void;
  onWidgetConfigChange?: (widgetId: string, config: Partial<DashboardWidgetConfig>) => void;
  onAddSectionClick?: () => void;
  onAddTitleClick?: () => void;
  /** Other tabs of this dashboard, used by the title widget's tab-link badges. */
  tabs?: Array<{ id: string; title: string; icon?: string }>;
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

// Fine row unit used to measure each zone's real height (Home Assistant style
// masonry: every item declares its own row-span instead of stretching to the
// tallest sibling in its row).
const CANVAS_ROW_UNIT = 8;

function getCanvasGap(columns: number): number {
  return columns === 1 ? 16 : 20;
}

/** Measures an element's rendered height and derives a grid row-span from it. */
function useMeasuredRowSpan(gap: number) {
  const [rowSpan, setRowSpan] = useState(1);
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      if (height > 0) {
        setRowSpan(Math.max(1, Math.ceil((height + gap) / (CANVAS_ROW_UNIT + gap))));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gap]);

  return { nodeRef, rowSpan };
}

/** Non-reorderable flow item (title widget, add-title/add-section placeholders). */
function CanvasFlowItem({
  span,
  gap,
  className,
  style,
  children,
}: {
  span: number;
  gap: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);

  return (
    <div
      ref={(node) => { nodeRef.current = node; }}
      style={{ gridColumn: `span ${span}`, gridRow: `span ${rowSpan}`, ...style }}
      className={cn("min-w-0", className)}
    >
      {children}
    </div>
  );
}

/** Reorderable zone: reordering drags the whole widget, sizing comes from its measured height. */
function SortableCanvasWidget({
  widget,
  columns,
  gap,
  isEditing,
  canDrag,
  isSelected,
  onClick,
  onConfigChange,
  onDelete,
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
  slotMode?: boolean;
}) {
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { kind: widget.type === 'section' ? 'section' : 'widget', sectionId: widget.id, cardCount: Array.isArray(widget.config.extra?.cards) ? widget.config.extra.cards.length : 0, getPreviewRect: () => nodeRef.current?.getBoundingClientRect() },
    disabled: !canDrag,
  });
  const span = clampSectionSpan(getSectionSpan(widget), columns);
  const { t } = useTranslation();
  const sectionDrag = canDrag && widget.type === 'section';
  const dragSurface = (target: EventTarget | null, surface: HTMLElement) => {
    if (!(target instanceof Element)) return false;
    const control = target.closest('[data-dashboard-card-id], button, input, select, textarea, a, [role="button"], [role="slider"]');
    return !control || control === surface;
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); nodeRef.current = node; }}
      {...(sectionDrag ? { ...attributes, 'aria-label': `${t('common.reorder')}: ${widget.config.appearance?.title || t('dashboard.editor.sections.untitled_section')}` } : {})}
      onMouseDown={sectionDrag ? event => { if (dragSurface(event.target, event.currentTarget)) listeners?.onMouseDown?.(event); } : undefined}
      onTouchStart={sectionDrag ? event => { if (dragSurface(event.target, event.currentTarget)) listeners?.onTouchStart?.(event); } : undefined}
      onKeyDown={sectionDrag ? event => { if (event.target === event.currentTarget) listeners?.onKeyDown?.(event); } : undefined}
      style={{
        gridColumn: slotMode ? undefined : `span ${span}`,
        gridRow: slotMode ? undefined : `span ${rowSpan}`,
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.3 : 1,
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
        dragHandleAttributes={attributes}
        dragHandleListeners={listeners}
        columns={columns}
      />
    </div>
  );
}

function SectionDropSlot({ index, columns, gap, editing, children }: { index: number; columns: number; gap: number; editing: boolean; children?: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `section-slot-${index}`, disabled: !editing });
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);
  return <div
    ref={(node) => { setNodeRef(node); nodeRef.current = node; }}
    style={{ gridColumn: (index % columns) + 1, gridRow: `span ${rowSpan}` }}
    data-section-slot={index}
    className={cn('min-w-0', !children && 'min-h-36', editing && !children && 'rounded-panel border border-dashed border-primary/25 bg-primary/[0.025]', isOver && editing && 'border-primary/75 bg-primary/10')}
  >{children}</div>;
}

export function DashboardCanvas({
  widgets,
  isEditing,
  onWidgetClick,
  selectedWidgetId,
  onLayoutChange, sectionLayout, onWidgetConfigChange, onAddSectionClick, onAddTitleClick,
  tabs, currentTabId, onSelectTab }: DashboardCanvasProps) {
  const { t } = useTranslation();
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const [dragPreview, setDragPreview] = useState<{ content?: ReactNode; width: number; height: number } | null>(null);
  const [pendingDeleteWidgetId, setPendingDeleteWidgetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const columns = useMemo(
    () => getDashboardSectionColumnsForViewport(containerWidth, viewportSize.width, viewportSize.height),
    [containerWidth, viewportSize.height, viewportSize.width],
  );
  const isPortraitKiosk = isPortraitKioskViewport(viewportSize.width, viewportSize.height);
  const gap = getCanvasGap(columns);
  // Editing (reorder + span) is available at every breakpoint: the flow model
  // no longer needs a desktop-only coordinate system to stay coherent.
  const canEditLayout = isEditing;

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

  const sanitizedWidgets = useMemo(() => {
    const baseWidgets = widgets.map(sanitizeWidget);

    const isBrokenSectionTitle = (value: unknown) =>
      typeof value === 'string' && /[ÃÂâÆ€]/.test(value);

    return baseWidgets.map((widget) => {
      if (widget.type !== 'section') return widget;
      if (!isBrokenSectionTitle(widget.config.appearance?.title)) return widget;

      return {
        ...widget,
        config: {
          ...widget.config,
          appearance: {
            ...widget.config.appearance,
            title: t('dashboard.editor.sections.new_section'),
          },
        },
      };
    });
  }, [widgets, t]);

  const titleWidget = sanitizedWidgets.find((widget) => widget.type === 'dashboard_title') ?? null;
  // Everything that isn't the pinned title flows and reorders together,
  // Home Assistant "Sections" style: order in this array is visual order.
  const flowWidgets = useMemo(
    () => sanitizedWidgets.filter((widget) => widget.type !== 'dashboard_title'),
    [sanitizedWidgets],
  );
  const flowWidgetIds = useMemo(() => flowWidgets.map((widget) => widget.id), [flowWidgets]);
  const sectionWidgets = useMemo(() => flowWidgets.filter((widget) => widget.type === 'section'), [flowWidgets]);
  const sectionSlots = useMemo(() => resolveSectionSlots(flowWidgets, sectionLayout, columns), [flowWidgets, sectionLayout, columns]);
  // All Sections render in one slot, including historical multitrack data.
  // Keep the sparse slot map authoritative wherever a profile was saved.
  const useSectionSlots = sectionWidgets.length > 0
    && sectionWidgets.every((widget) => getSectionSpan(widget) === 1);
  const slotCount = useSectionSlots
    ? Math.ceil(sectionSlots.length / columns) * columns + (isEditing ? columns : 0)
    : 0;
  const sectionById = useMemo(() => new Map(sectionWidgets.map((widget) => [widget.id, widget])), [sectionWidgets]);

  const sensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  const sensors = useSensors(
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, args) => {
        // Ancestor Sections are not card destinations unless empty. Leave the
        // registered containers intact and filter only measured candidates.
        const isCard = args.context.active?.data.current?.kind === 'section-card';
        const droppableRects = new Map(args.context.droppableRects);
        for (const container of args.context.droppableContainers.getEnabled()) {
          const data = container.data.current;
          const eligible = isCard ? data?.kind === 'section-card' || (data?.kind === 'section' && data.cardCount === 0)
            : data?.kind !== 'section-card';
          if (!eligible) droppableRects.delete(container.id);
        }
        return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableRects } });
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditLayout) return;
    const widget = flowWidgets.find((w) => w.id === event.active.id);
    if (widget) setActiveWidget(widget);
    const getPreviewRect = event.active.data.current?.getPreviewRect;
    const rect = event.active.rect.current.initial ?? (typeof getPreviewRect === 'function' ? getPreviewRect() : null);
    if (rect) setDragPreview({ width: rect.width, height: rect.height,
      content: isValidElement(event.active.data.current?.preview) ? event.active.data.current.preview : undefined });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    setDragPreview(null);
    if (!canEditLayout) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const source = active.data.current;
    const destination = over.data.current;
    if (source?.kind === 'section-card') {
      if (typeof source.sectionId !== 'string' || typeof source.cardId !== 'string' || typeof destination?.sectionId !== 'string') return;
      const moved = moveSectionCard(widgets, source.sectionId, source.cardId, destination.sectionId, destination.kind === 'section-card' ? destination.cardId : undefined);
      if (moved !== widgets) onLayoutChange(moved, sectionLayout);
      return;
    }

    if (useSectionSlots && sectionById.has(String(active.id))) {
      const target = String(over.id);
      const targetIndex = target.startsWith('section-slot-')
        ? Number(target.slice('section-slot-'.length))
        : sectionSlots.indexOf(target);
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
  };

  const collisionDetection: CollisionDetection = (args) => {
    const isCard = args.active.data.current?.kind === 'section-card';
    const droppableContainers = args.droppableContainers.filter((container) => isCard
      ? container.data.current?.kind === 'section-card' || container.data.current?.kind === 'section'
      : container.data.current?.kind !== 'section-card');
    if (!isCard) return rectIntersection({ ...args, droppableContainers });
    const hits = pointerWithin({ ...args, droppableContainers });
    const cardHits = hits.filter((hit) => droppableContainers.find((container) => container.id === hit.id)?.data.current?.kind === 'section-card');
    return cardHits.length ? cardHits : hits.length ? hits : closestCenter({ ...args, droppableContainers });
  };


  const pendingDeleteWidget = pendingDeleteWidgetId
    ? widgets.find((widget) => widget.id === pendingDeleteWidgetId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SectionCardDragContext.Provider value={true}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full grid min-w-0 overflow-x-hidden",
          isPortraitKiosk && "homepilot-portrait-kiosk-canvas",
          isEditing
            ? "outline outline-2 outline-dashed outline-offset-[-2px] outline-primary/10 bg-card/20 bg-dashboard-grid bg-dashboard shadow-2xl shadow-primary/5"
            : "bg-transparent"
        )}
        style={{
          // auto-fit + minmax(min(100%, 350px), 1fr): a section uses its 350px
          // readable basis where space permits, but never exceeds the mobile
          // canvas width after padding is included. Critically, the track has
          // NO max-width on the track itself, so with few sections on a
          // wide monitor the 1fr share stretches each one edge to edge
          // instead of leaving blank margins on the sides. Wraps to a new
          // row instead of squeezing when a section doesn't fit. This
          // 350px basis (+ the canvas gap) MUST match
          // getDashboardSectionColumns' own basis in dashboardUtils.ts —
          // that JS-computed count decides grid-column: span N for the
          // actual title widget, and a mismatched count forces CSS to
          // add an extra implicit column instead of wrapping.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gridAutoRows: `${CANVAS_ROW_UNIT}px`,
          gridAutoFlow: 'row',
          alignItems: 'start',
          gap: `${gap}px`,
        }}
      >
        {titleWidget ? (
          <CanvasFlowItem span={columns} gap={gap}>
            <DashboardWidgetNode
              widget={titleWidget}
              isEditing={isEditing}
              canDrag={false}
              isSelected={isEditing && selectedWidgetId === titleWidget.id}
              onClick={() => { if (isEditing) onWidgetClick(titleWidget.id); }}
              onConfigChange={onWidgetConfigChange}
              onDelete={setPendingDeleteWidgetId}
              titleBadgeTabs={tabs}
              currentTabId={currentTabId}
              onSelectTab={onSelectTab}
            />
          </CanvasFlowItem>
        ) : null}

        {useSectionSlots && <CanvasFlowItem span={columns} gap={gap}>
          <SortableContext items={sectionWidgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
            <div className="grid min-w-0 items-start" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${CANVAS_ROW_UNIT}px`, gridAutoFlow: 'row dense', gap: `${gap}px` }}>
              {Array.from({ length: slotCount }, (_, index) => {
                const widget = sectionById.get(sectionSlots[index] ?? '');
                return <SectionDropSlot key={index} index={index} columns={columns} gap={gap} editing={isEditing}>
                  {widget && <SortableCanvasWidget
                    widget={widget} columns={columns} gap={gap} slotMode
                    isEditing={isEditing} canDrag={canEditLayout}
                    isSelected={selectedWidgetId === widget.id}
                    onClick={onWidgetClick} onConfigChange={onWidgetConfigChange}
                    onDelete={setPendingDeleteWidgetId}
                  />}
                </SectionDropSlot>;
              })}
            </div>
          </SortableContext>
        </CanvasFlowItem>}
        <SortableContext items={useSectionSlots ? flowWidgetIds.filter((id) => !sectionById.has(id)) : flowWidgetIds} strategy={rectSortingStrategy}>
          {flowWidgets.filter((widget) => !useSectionSlots || widget.type !== 'section').map((widget) => (
            <SortableCanvasWidget
              key={widget.id}
              widget={widget}
              columns={columns}
              gap={gap}
              isEditing={isEditing}
              canDrag={canEditLayout}
              isSelected={selectedWidgetId === widget.id}
              onClick={onWidgetClick}
              onConfigChange={onWidgetConfigChange}
              onDelete={setPendingDeleteWidgetId}
            />
          ))}
        </SortableContext>

        <ConfirmModal
          isOpen={pendingDeleteWidgetId !== null}
          onClose={() => setPendingDeleteWidgetId(null)}
          onConfirm={() => {
            if (pendingDeleteWidgetId) {
              onLayoutChange(widgets.filter((candidate) => candidate.id !== pendingDeleteWidgetId));
            }
            setPendingDeleteWidgetId(null);
          }}
          title={t(pendingDeleteWidget?.type === 'dashboard_title' ? 'dashboards.delete_title_title' : 'common.delete')}
          description={t(pendingDeleteWidget?.type === 'dashboard_title' ? 'dashboards.delete_title_description' : 'dashboards.delete_tab_confirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />
        {createPortal(<DragOverlay zIndex={60} style={{ pointerEvents: 'none' }} dropAnimation={{
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
              className="pointer-events-none grid rounded-panel shadow-depth-3 ring-2 ring-primary/50 bg-card motion-safe:scale-[1.025]"
              style={{
                width: dragPreview.width, height: dragPreview.height, containerType: 'inline-size',
              }}
            >
              {dragPreview.content ?? (activeWidget && <SectionCardDragContext.Provider value={false}><WidgetContent
                widget={activeWidget}
                isEditing={false}
                onClick={() => {}}
              /></SectionCardDragContext.Provider>)}
            </div>
          ) : null}
        </DragOverlay>, document.body)}
      </div>
      {canEditLayout && !titleWidget && <Button type="button" variant="outline" size="md" onClick={onAddTitleClick}>{t('dashboard.editor.sections.add_title')}</Button>}
      {canEditLayout && (
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onAddSectionClick}
          aria-label={t('dashboard.editor.sections.add_section')}
          className="w-full max-w-sm rounded-field border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
        >
          <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-panel-title font-light leading-none text-primary">
            +
          </span>
        </Button>
      )}
      </SectionCardDragContext.Provider>
    </DndContext>
  );
}
