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
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { useAssistantStore } from '../../stores/useAssistantStore';
import { isDeviceActive, sanitizeWidget } from './dashboardUtils';

interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  isEditing: boolean;
  onWidgetClick: (id: string) => void;
  selectedWidgetId: string | null;
  onLayoutChange: (widgets: DashboardWidget[]) => void;
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
  if (width > 0 && width < 1024) return TABLET_GRID_COLS;
  return DESKTOP_GRID_COLS;
}

function clampLayoutWidth(width: number, cols: number): number {
  return Math.max(1, Math.min(cols, width));
}

function getResponsiveWidgetWidth(widget: DashboardWidget, cols: number): number {
  if (cols === DESKTOP_GRID_COLS) {
    return clampLayoutWidth(widget.config.layout.w, cols);
  }

  if (widget.type === 'section') return cols;
  if (cols === MOBILE_GRID_COLS) return 1;

  const scaled = Math.ceil((widget.config.layout.w / DESKTOP_GRID_COLS) * cols);

  switch (widget.type) {
    case 'device_control':
    case 'scene_shortcut':
      return clampLayoutWidth(Math.max(2, scaled), cols);
    case 'clock_display':
    case 'room_overview':
    case 'room_summary':
    case 'energy_snapshot':
    case 'assistant_insight':
    case 'system_status':
    case 'activity_feed':
      return clampLayoutWidth(Math.max(3, scaled), cols);
    default:
      return clampLayoutWidth(Math.max(2, scaled), cols);
  }
}

function getResponsiveWidgetHeight(widget: DashboardWidget, cols: number): number {
  const original = Math.max(1, widget.config.layout.h);

  if (cols === DESKTOP_GRID_COLS) return original;
  if (widget.type === 'section') return 1;

  if (cols === MOBILE_GRID_COLS) {
    switch (widget.type) {
      case 'device_control':
        return Math.max(2, Math.min(5, original));
      case 'scene_shortcut':
        return Math.max(3, Math.min(5, original));
      case 'clock_display':
        return Math.max(3, Math.min(6, original));
      case 'room_overview':
      case 'room_summary':
        return Math.max(3, Math.min(6, original));
      case 'energy_snapshot':
      case 'assistant_insight':
      case 'system_status':
      case 'activity_feed':
        return Math.max(4, Math.min(7, original));
      default:
        return Math.max(3, Math.min(6, original));
    }
  }

  switch (widget.type) {
    case 'device_control':
      return Math.max(2, original);
    case 'clock_display':
    case 'room_overview':
    case 'room_summary':
    case 'scene_shortcut':
      return Math.max(3, original);
    default:
      return Math.max(3, original);
  }
}

function canPlace(occupied: boolean[][], x: number, y: number, w: number, h: number, cols: number): boolean {
  if (x < 0 || x + w > cols) return false;

  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      if (occupied[row]?.[col]) return false;
    }
  }

  return true;
}

function markOccupied(occupied: boolean[][], x: number, y: number, w: number, h: number): void {
  for (let row = y; row < y + h; row += 1) {
    occupied[row] ??= [];
    for (let col = x; col < x + w; col += 1) {
      occupied[row][col] = true;
    }
  }
}

function packResponsiveWidgets(widgets: DashboardWidget[], cols: number): DashboardWidget[] {
  const ordered = [...widgets].sort((a, b) => {
    const byY = a.config.layout.y - b.config.layout.y;
    if (byY !== 0) return byY;
    return a.config.layout.x - b.config.layout.x;
  });

  if (cols === DESKTOP_GRID_COLS) {
    return ordered.map((widget) => ({
      ...widget,
      config: {
        ...widget.config,
        layout: {
          ...widget.config.layout,
          x: Math.max(0, Math.min(DESKTOP_GRID_COLS - 1, widget.config.layout.x)),
          w: Math.min(widget.config.layout.w, DESKTOP_GRID_COLS - Math.max(0, widget.config.layout.x)),
          h: Math.max(1, widget.config.layout.h),
        },
      },
    }));
  }

  const occupied: boolean[][] = [];

  return ordered.map((widget) => {
    const w = getResponsiveWidgetWidth(widget, cols);
    const h = getResponsiveWidgetHeight(widget, cols);

    let placedX = 0;
    let placedY = 0;
    let found = false;

    for (let y = 0; y < 500 && !found; y += 1) {
      for (let x = 0; x <= cols - w; x += 1) {
        if (canPlace(occupied, x, y, w, h, cols)) {
          placedX = x;
          placedY = y;
          found = true;
          break;
        }
      }
    }

    markOccupied(occupied, placedX, placedY, w, h);

    return {
      ...widget,
      config: {
        ...widget.config,
        layout: {
          ...widget.config.layout,
          x: placedX,
          y: placedY,
          w,
          h,
        },
      },
    };
  });
}

export function DashboardCanvas({ 
  widgets, 
  isEditing, 
  onWidgetClick, 
  selectedWidgetId,
  onLayoutChange,
  onAddCardClick, onAddSectionClick, onAddTitleClick }: DashboardCanvasProps) {
  const { t } = useTranslation();
  void onAddCardClick;
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { devices } = useDeviceSnapshotStore();
  const { findings } = useAssistantStore();

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

  if (!isEditing) return baseWidgets;

  const sectionCount = baseWidgets.filter(widget => widget.type === 'section').length;

  const getEditSectionLayout = (sectionIndex: number) => {
    const row = Math.floor(sectionIndex / 4);
    const indexInRow = sectionIndex % 4;
    const rowStart = row * 4;
    const itemsInRow = Math.min(4, sectionCount - rowStart);
    const isLastRow = rowStart + itemsInRow >= sectionCount;
    const effectiveCount = isLastRow && itemsInRow < 4 ? Math.min(4, itemsInRow + 1) : itemsInRow;
    const width = Math.floor(12 / Math.max(1, effectiveCount));

    return {
      x: indexInRow * width,
      y: 2 + row * 2,
      w: width,
      h: 2,
    };
  };

  const isBrokenSectionTitle = (value: unknown) =>
    typeof value === 'string' && /[\u00c3\u00c2\u00e2\u00c6\u20ac]/.test(value);

  let sectionIndex = 0;

  return baseWidgets.map((widget) => {
    if (widget.type !== 'section') return widget;

    const layout = getEditSectionLayout(sectionIndex);
    sectionIndex += 1;

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
  
  const evaluateVisibility = useCallback((widget: DashboardWidget): boolean => {
    if (isEditing) return true; // Always show in edit mode
    
    const { rules, defaultState } = widget.config.visibility;
    if (!rules || rules.length === 0) return defaultState === 'show';

    for (const rule of rules) {
      if (rule.type === 'always') return rule.action === 'show';
      
      if (rule.type === 'device_on') {
         const device = devices.find(d => d.id === rule.value);
         const isOn = device ? isDeviceActive(device) : false;
         if (isOn) return rule.action === 'show';
      }

      if (rule.type === 'has_alerts') {
         const hasAlerts = findings.some(f => f.severity === 'high' || f.severity === 'medium');
         if (hasAlerts) return rule.action === 'show';
      }

      if (rule.type === 'time_range' && rule.value) {
         const [start, end] = rule.value.split('-').map(t => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
         });
         const now = new Date();
         const minutes = now.getHours() * 60 + now.getMinutes();
         
         const isInside = start <= end 
            ? (minutes >= start && minutes <= end)
            : (minutes >= start || minutes <= end);
            
         if (isInside) return rule.action === 'show';
      }
    }

    return defaultState === 'show';
  }, [isEditing, devices, findings]);

  const visibleWidgets = useMemo(() => 
    sanitizedWidgets.filter(evaluateVisibility),
    [sanitizedWidgets, evaluateVisibility]
  );

  const renderedWidgets = useMemo(
    () => packResponsiveWidgets(visibleWidgets, gridCols),
    [visibleWidgets, gridCols]
  );

  // Compute virtual placeholders for HASS-style add-card and add-section buttons.
const virtualPlaceholders = useMemo(() => {
  if (!canEditLayout) return [];

  const sections = sanitizedWidgets
    .filter(widget => widget.type === 'section')
    .sort((a, b) => {
      const byY = a.config.layout.y - b.config.layout.y;
      if (byY !== 0) return byY;
      return a.config.layout.x - b.config.layout.x;
    });

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

  const sectionStartY = 2;
  const sectionsInCurrentRow = sections.length % 4;
  const completedRows = Math.floor(sections.length / 4);

  if (sections.length === 0) {
    placeholders.push({ key: 'add_section_final', x: 4, y: sectionStartY, w: 4, h: 1, type: 'add_section' });
  } else {
    const slotCount = sectionsInCurrentRow === 0 ? 1 : Math.min(4, sectionsInCurrentRow + 1);
    const slotW = Math.floor(12 / slotCount);
    const placeholderSlot = sectionsInCurrentRow === 0 ? 0 : sectionsInCurrentRow;

    placeholders.push({
      key: 'add_section_final',
      x: placeholderSlot * slotW,
      y: sectionStartY + completedRows * 2,
      w: slotW,
      h: 2,
      type: 'add_section',
    });
  }

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

const canvasMinRows = useMemo(() => {
    const bottomY = renderedWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);
    return Math.max(8, bottomY + (canEditLayout ? 6 : 2));
  }, [renderedWidgets, canEditLayout]);

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
            ? "border-2 border-dashed border-primary/10 bg-card/20 p-3 sm:p-4 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:20px_20px] shadow-2xl shadow-primary/5"
            : "border-transparent bg-transparent p-0"
        )}
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
          minHeight: `${canvasMinRows * rowHeight}px`,
        }}
      >
        {renderedWidgets.map((widget) => (
          <div
            key={widget.id}
            id={widget.id}
            style={{
              gridColumn: `${widget.config.layout.x + 1} / span ${Math.min(widget.config.layout.w, gridCols - widget.config.layout.x)}`,
              gridRow: `${widget.config.layout.y + 1} / span ${widget.config.layout.h}`,
              opacity: activeWidget?.id === widget.id ? 0.3 : 1,
            }}
            className={cn(
              "min-w-0 min-h-0 select-none transition-all duration-300 relative rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]",
              canEditLayout && "cursor-grab active:cursor-grabbing hover:z-10",
              selectedWidgetId === widget.id && isEditing && "z-10 ring-4 ring-primary ring-offset-4 ring-offset-background shadow-[0_0_50px_rgba(var(--primary),0.3)]"
            )}
          >
            <DashboardWidgetNode
              widget={widget}
              isEditing={canEditLayout}
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
            />
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
        "absolute z-10 flex transition-all duration-200",
        isAddTitle
          ? "items-center justify-center rounded-[1.25rem] border-2 border-dashed border-border/60 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
          : "items-center justify-center rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
      )}
      style={{
        left: placeholder.x * colWidth + 8,
        top: placeholder.y * rowHeight + 8,
        width: placeholder.w * colWidth - 16,
        height: placeholder.h * rowHeight - 16,
      }}
    >
      {isAddTitle ? (
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      ) : (
        <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-xl font-light leading-none text-primary">
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
            className="rounded-[2.5rem] border-2 border-dashed border-primary/40 bg-primary/5 transition-all duration-100"
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
              className="rounded-[2rem] shadow-2xl opacity-80 border border-primary/20 bg-card/80 backdrop-blur-xl"
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