import { 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/core';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { DashboardWidget } from './types';
import { DashboardWidgetNode, WidgetContent } from './DashboardWidget';
import {
  getDashboardSectionPlaceholderY,
  resolveDashboardSectionLayouts,
  sanitizeWidget,
} from './dashboardUtils';

interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  isEditing: boolean;
  onWidgetClick: (id: string) => void;
  selectedWidgetId: string | null;
  onLayoutChange: (widgets: DashboardWidget[]) => void; onWidgetConfigChange?: (widgetId: string, config: Partial<DashboardWidget['config']>) => void;
  onAddCardClick?: (x: number, y: number) => void;
  onAddSectionClick?: (y: number) => void; onAddTitleClick?: () => void;
}

const DESKTOP_GRID_COLS = 12;
const TABLET_GRID_COLS = 6;
const MOBILE_GRID_COLS = 1;

// Minimum row height in pixels. The actual rowHeight is derived from colWidth
// so the grid stays proportional at any screen size.
const MIN_ROW_HEIGHT = 40;
const MAX_ROW_HEIGHT = 80;

function getCanvasColumns(width: number): number {
  if (width > 0 && width < 640) return MOBILE_GRID_COLS;
  if (width > 0 && width < 1280) return TABLET_GRID_COLS;
  return DESKTOP_GRID_COLS;
}

export function DashboardCanvas({ 
  widgets, 
  isEditing, 
  onWidgetClick, 
  selectedWidgetId,
  onLayoutChange, onWidgetConfigChange, onAddCardClick, onAddSectionClick, onAddTitleClick }: DashboardCanvasProps) {
  const { t } = useTranslation();
  void onAddCardClick;
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
// Track live column width so drag calculations and DragOverlay stay accurate.
  const [containerWidth, setContainerWidth] = useState(0);
  const gridCols = useMemo(() => getCanvasColumns(containerWidth), [containerWidth]);
  const isResponsiveLayout = gridCols !== DESKTOP_GRID_COLS;
  const canEditLayout = isEditing && !isResponsiveLayout;
  const colWidth = containerWidth > 0 ? containerWidth / gridCols : 0;
  const rowHeight = colWidth > 0
    ? Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Math.round(colWidth * 0.7)))
    : MIN_ROW_HEIGHT;
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

const sanitizedWidgets = useMemo(() => {
  const baseWidgets = widgets.map(sanitizeWidget);
  const sectionLayouts = resolveDashboardSectionLayouts(baseWidgets, isEditing);

  const isBrokenSectionTitle = (value: unknown) =>
    typeof value === 'string' && /[\u00c3\u00c2\u00e2\u00c6\u20ac]/.test(value);

  return baseWidgets.map((widget) => {
    if (widget.type !== 'section') return widget;
    const layout = sectionLayouts.get(widget.id) ?? widget.config.layout;

    return {
      ...widget,
      config: {
        ...widget.config,
        layout,
        appearance: {
          ...widget.config.appearance,
          title: isBrokenSectionTitle(widget.config.appearance?.title)
            ? t('dashboard.editor.sections.new_section')
            : widget.config.appearance?.title,
        },
      },
    };
  });
}, [widgets, isEditing, t]);

  const renderedWidgets = sanitizedWidgets;

  const getResponsiveGridColumn = useCallback((widget: DashboardWidget) => {
    if (!isResponsiveLayout) {
      return `${widget.config.layout.x + 1} / span ${Math.min(widget.config.layout.w, gridCols - widget.config.layout.x)}`;
    }

    if (gridCols === MOBILE_GRID_COLS) return '1 / -1';

    const isWideWidget = widget.type === 'dashboard_title'
      || widget.type === 'section'
      || widget.config.layout.w >= DESKTOP_GRID_COLS / 2;

    return `auto / span ${isWideWidget ? TABLET_GRID_COLS : Math.max(1, TABLET_GRID_COLS / 2)}`;
  }, [gridCols, isResponsiveLayout]);

// Compute virtual placeholders for HASS-style add-card and add-section buttons.
const virtualPlaceholders = useMemo(() => {
  if (!canEditLayout) return [];

  const sections = sanitizedWidgets.filter(widget => widget.type === 'section');

  const hasDashboardTitle = sanitizedWidgets.some(widget => widget.type === 'dashboard_title');

  const placeholders: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: 'add_title' | 'add_section';
  }[] = [];

  if (!hasDashboardTitle) {
    placeholders.push({ key: 'add_title', x: 0, y: 0, w: 12, h: 2, type: 'add_title' });
  }

  if (sections.length === 0) {
    placeholders.push({
      key: 'add_section_final',
      x: 4,
      y: 2,
      w: 4,
      h: 1,
      type: 'add_section',
    });

    return placeholders;
  }

  placeholders.push({
    key: 'add_section_final',
    x: 0,
    y: getDashboardSectionPlaceholderY(
      new Map(sections.map((section) => [section.id, section.config.layout])),
    ),
    w: 12,
    h: 1,
    type: 'add_section',
  });

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

// V19 preserves section layout height for internal section cards
const canvasMinRows = useMemo(() => {
    const widgetBottom = renderedWidgets.reduce(
      (max: number, widget: DashboardWidget) => Math.max(max, widget.config.layout.y + widget.config.layout.h),
      0,
    );
    const placeholderBottom = virtualPlaceholders.reduce(
      (max, placeholder) => Math.max(max, placeholder.y + placeholder.h),
      0,
    );

    return Math.max(1, widgetBottom, placeholderBottom);
  }, [renderedWidgets, virtualPlaceholders]);

  const sensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions)
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditLayout) return;
    const widget = sanitizedWidgets.find((w) => w.id === event.active.id);
    if (widget) {
      setActiveWidget(widget);
      setSnapPreview({ x: widget.config.layout.x, y: widget.config.layout.y, w: widget.config.layout.w, h: widget.config.layout.h });
    }
  };

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!canEditLayout || colWidth === 0) return;
    const widget = sanitizedWidgets.find((w) => w.id === event.active.id);
    if (!widget) return;
    const dx = Math.round(event.delta.x / colWidth);
    const dy = Math.round(event.delta.y / rowHeight);
    const newX = Math.max(0, Math.min(DESKTOP_GRID_COLS - widget.config.layout.w, widget.config.layout.x + dx));
    const newY = Math.max(0, widget.config.layout.y + dy);
    setSnapPreview({ x: newX, y: newY, w: widget.config.layout.w, h: widget.config.layout.h });
  }, [canEditLayout, colWidth, rowHeight, sanitizedWidgets]);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    setSnapPreview(null);
    const { active, delta } = event;
    
    if (!canEditLayout || colWidth === 0) return;

    const widget = sanitizedWidgets.find((w) => w.id === active.id);
    if (!widget) return;

    const dx = Math.round(delta.x / colWidth);
    const dy = Math.round(delta.y / rowHeight);

    // Clamp so widget never exits the grid horizontally
    const newX = Math.max(0, Math.min(DESKTOP_GRID_COLS - widget.config.layout.w, widget.config.layout.x + dx));
    const newY = Math.max(0, widget.config.layout.y + dy);

    // Block if overlapping another widget
    const hasCollision = sanitizedWidgets.some(w => {
       if (w.id === widget.id) return false;
       return (
         newX < w.config.layout.x + w.config.layout.w &&
         newX + widget.config.layout.w > w.config.layout.x &&
         newY < w.config.layout.y + w.config.layout.h &&
         newY + widget.config.layout.h > w.config.layout.y
       );
    });

    if (hasCollision) return; // Don't update if blocked

    if (newX !== widget.config.layout.x || newY !== widget.config.layout.y) {
      const updatedWidgets = sanitizedWidgets.map(w => 
        w.id === widget.id ? { ...w, config: { ...w.config, layout: { ...w.config.layout, x: newX, y: newY } } } : w
      );
      onLayoutChange(updatedWidgets);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={containerRef}
        className={cn(
          "relative w-full grid gap-2.5 transition-all duration-500 sm:gap-3 lg:gap-4",
          isEditing
            ? "border-2 border-dashed border-primary/10 bg-card/20 p-3 sm:p-4 bg-dashboard-grid bg-dashboard shadow-2xl shadow-primary/5"
            : "border-transparent bg-transparent p-0"
        )}
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridAutoRows: isResponsiveLayout ? undefined : `${rowHeight}px`,
          minHeight: isResponsiveLayout ? undefined : `${canvasMinRows * rowHeight}px`,
        }}
      >
        {renderedWidgets.map((widget: DashboardWidget) => (
          <div
            key={widget.id}
            id={widget.id}
            style={{
              gridColumn: getResponsiveGridColumn(widget),
              gridRow: isResponsiveLayout ? undefined : `${widget.config.layout.y + 1} / span ${widget.config.layout.h}`,
              opacity: activeWidget?.id === widget.id ? 0.3 : 1,
            }}
            className={cn(
              "min-w-0 min-h-0 select-none transition-all duration-300 relative rounded-section sm:rounded-panel lg:rounded-dashboard",
              canEditLayout && "cursor-grab active:cursor-grabbing hover:z-10",
              selectedWidgetId === widget.id && isEditing && "z-10 ring-4 ring-primary ring-offset-4 ring-offset-background shadow-primary-ring"
            )}
          >
            <DashboardWidgetNode
              widget={widget}
              isEditing={isEditing}
              canDrag={canEditLayout}
              isSelected={isEditing && selectedWidgetId === widget.id}
              onClick={() => { if (isEditing) onWidgetClick(widget.id); }}
              onResizeEnd={(id, w, h) => {
                 // Clamp width so widget never exits the desktop grid
                 const originalWidget = sanitizedWidgets.find(item => item.id === id);
                 if (!originalWidget) return;
                 const layout = originalWidget.config.layout;
                 const clampedW = Math.min(w, DESKTOP_GRID_COLS - layout.x);
                 const clampedH = Math.max(1, h);

                 // Collision check with clamped dimensions
                 const hasCollision = sanitizedWidgets.some(other => {
                    if (other.id === id) return false;
                    const otherLayout = other.config.layout;
                    return (
                      layout.x < otherLayout.x + otherLayout.w &&
                      layout.x + clampedW > otherLayout.x &&
                      layout.y < otherLayout.y + otherLayout.h &&
                      layout.y + clampedH > otherLayout.y
                    );
                 });

                 if (!hasCollision) {
                    const updatedWidgets = sanitizedWidgets.map(wgt => 
                       wgt.id === id ? { ...wgt, config: { ...wgt.config, layout: { ...wgt.config.layout, w: clampedW, h: clampedH } } } : wgt
                    );
                    onLayoutChange(updatedWidgets);
                 }
              }}
             onConfigChange={onWidgetConfigChange} />
          </div>
        ))}

        {/* Home Assistant style virtual placeholders */}
{canEditLayout && virtualPlaceholders.map((placeholder) => {
  const isAddTitle = placeholder.type === 'add_title';

  return (
    <button
      key={placeholder.key}
      type="button"
      onClick={() => {
        if (isAddTitle) {
          onAddTitleClick?.();
        } else {
          onAddSectionClick?.(placeholder.y);
        }
      }}
      aria-label={isAddTitle ? t('dashboard.editor.sections.add_title') : t('dashboard.editor.sections.add_section')}
      className={cn(
        "z-10 flex min-h-0 min-w-0 transition-all duration-200",
        isAddTitle
          ? "items-center justify-center rounded-section border-2 border-dashed border-border/60 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
          : "items-center justify-center rounded-field border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
      )}
      style={{
        gridColumn: `${placeholder.x + 1} / span ${Math.min(placeholder.w, gridCols - placeholder.x)}`,
        gridRow: `${placeholder.y + 1} / span ${placeholder.h}`,
      }}
    >
      {isAddTitle ? (
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-body font-semibold text-primary">
          <span className="text-panel-title leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      ) : (
        <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-panel-title font-light leading-none text-primary">
          +
        </span>
      )}
    </button>
  );
})}
 {/* Snap drop preview */}
        {canEditLayout && snapPreview && activeWidget && (
          <div
            aria-hidden="true"
            style={{
              gridColumn: `${snapPreview.x + 1} / span ${Math.min(snapPreview.w, DESKTOP_GRID_COLS - snapPreview.x)}`,
              gridRow: `${snapPreview.y + 1} / span ${snapPreview.h}`,
              pointerEvents: 'none',
            }}
            className="rounded-dashboard border-2 border-dashed border-primary/40 bg-primary/5 transition-all duration-100"
          />
        )}
        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
          {canEditLayout && activeWidget && colWidth > 0 ? (
            <div
              className="rounded-panel shadow-2xl opacity-80 border border-primary/20 bg-card/80 backdrop-blur-xl"
              style={{
                width: colWidth * activeWidget.config.layout.w - 16,
                height: rowHeight * activeWidget.config.layout.h - 16,
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
