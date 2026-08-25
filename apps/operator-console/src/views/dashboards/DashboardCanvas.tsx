import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useMemo, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
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
  onLayoutChange: (widgets: DashboardWidget[]) => void;
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !canDrag,
  });
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);
  const span = clampSectionSpan(getSectionSpan(widget), columns);

  return (
    <div
      ref={(node) => { setNodeRef(node); nodeRef.current = node; }}
      style={{
        gridColumn: `span ${span}`,
        gridRow: `span ${rowSpan}`,
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.3 : 1,
      }}
      className={cn(
        "min-w-0 min-h-0 select-none relative rounded-section sm:rounded-panel lg:rounded-dashboard",
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

export function DashboardCanvas({
  widgets,
  isEditing,
  onWidgetClick,
  selectedWidgetId,
  onLayoutChange, onWidgetConfigChange, onAddSectionClick, onAddTitleClick,
  tabs, currentTabId, onSelectTab }: DashboardCanvasProps) {
  const { t } = useTranslation();
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
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

  const sensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditLayout) return;
    const widget = flowWidgets.find((w) => w.id === event.active.id);
    if (widget) setActiveWidget(widget);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    if (!canEditLayout) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = flowWidgets.findIndex((w) => w.id === active.id);
    const newIndex = flowWidgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedFlow = arrayMove(flowWidgets, oldIndex, newIndex);
    const reordered = titleWidget ? [titleWidget, ...reorderedFlow] : reorderedFlow;
    onLayoutChange(reordered);
  };

  const handleDragCancel = () => {
    setActiveWidget(null);
  };


  const pendingDeleteWidget = pendingDeleteWidgetId
    ? widgets.find((widget) => widget.id === pendingDeleteWidgetId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative w-full grid min-w-0 overflow-x-hidden transition-all duration-500",
          isPortraitKiosk && "homepilot-portrait-kiosk-canvas",
          isEditing
            ? "min-h-[calc(100dvh-8rem)] border-2 border-dashed border-primary/10 bg-card/20 p-3 sm:p-4 bg-dashboard-grid bg-dashboard shadow-2xl shadow-primary/5"
            : "border-transparent bg-transparent p-0"
        )}
        style={{
          // auto-fit + minmax(350px, 1fr): a section never shrinks below
          // 350px (never collapses to a sliver), but — critically — has
          // NO max-width on the track itself, so with few sections on a
          // wide monitor the 1fr share stretches each one edge to edge
          // instead of leaving blank margins on the sides. Wraps to a new
          // row instead of squeezing when a section doesn't fit. This
          // 350px basis (+ the canvas gap) MUST match
          // getDashboardSectionColumns' own basis in dashboardUtils.ts —
          // that JS-computed count decides grid-column: span N for the
          // title/add-section placeholders, and a mismatched count forces
          // CSS to add an extra implicit column, which overflows the
          // viewport instead of wrapping.
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
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
        ) : canEditLayout ? (
          <CanvasFlowItem span={columns} gap={gap}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onAddTitleClick}
              aria-label={t('dashboard.editor.sections.add_title')}
              className="min-h-0 w-full rounded-section border-2 border-dashed border-border/60 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
            >
              <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-body font-semibold text-primary">
                <span className="text-panel-title leading-none">+</span>
                <span>{t('dashboard.editor.sections.add_title')}</span>
              </span>
            </Button>
          </CanvasFlowItem>
        ) : null}

        <SortableContext items={flowWidgetIds} strategy={rectSortingStrategy}>
          {flowWidgets.map((widget) => (
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

        {canEditLayout && (
          <CanvasFlowItem span={1} gap={gap}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onAddSectionClick}
              aria-label={t('dashboard.editor.sections.add_section')}
              className="min-h-0 w-full rounded-field border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
            >
              <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-panel-title font-light leading-none text-primary">
                +
              </span>
            </Button>
          </CanvasFlowItem>
        )}

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
        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
          {canEditLayout && activeWidget ? (
            <div
              className="rounded-panel shadow-2xl opacity-80 border border-primary/20 bg-card/80 backdrop-blur-xl"
              style={{
                width: containerWidth > 0
                  ? (containerWidth / columns) * clampSectionSpan(getSectionSpan(activeWidget), columns) - gap
                  : undefined,
              }}
            >
              <WidgetContent
                widget={activeWidget}
                isEditing={false}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
