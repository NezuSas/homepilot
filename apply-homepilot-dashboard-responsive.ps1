$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Content, $encoding)
}

function Replace-InFile {
  param([string]$Path, [string]$Old, [string]$New)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $content = Get-Content -LiteralPath $Path -Raw
  $content = $content.Replace($Old, $New)
  Write-FileUtf8NoBom -Path $Path -Content $content
}

$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
if (-not (Test-Path -LiteralPath $canvasPath)) {
  throw "No existe $canvasPath. Ejecuta este script desde la raíz de homepilot."
}

$canvas = @'
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
  onAddSectionClick?: (y: number) => void;
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
  onAddCardClick,
  onAddSectionClick
}: DashboardCanvasProps) {
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

  const sanitizedWidgets = useMemo(() => widgets.map(sanitizeWidget), [widgets]);
  
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
  // Layout editing is desktop-only; mobile/tablet use a responsive packed projection.
  const virtualPlaceholders = useMemo(() => {
    if (!canEditLayout) return [];

    const sections = sanitizedWidgets.filter(w => w.type === 'section');
    const placeholders: { key: string; x: number; y: number; w: number; h: number; type: 'add_card' | 'add_section' }[] = [];

    // 1. Group widgets and place an "add card" block under each section
    if (sections.length === 0) {
      const bottomY = sanitizedWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);
      placeholders.push({
        key: 'add_card_root',
        x: 0,
        y: bottomY,
        w: 4,
        h: 2,
        type: 'add_card'
      });
    } else {
      const sortedSections = [...sections].sort((a, b) => a.config.layout.y - b.config.layout.y);
      
      // Before first section
      const firstSecY = sortedSections[0].config.layout.y;
      const preWidgets = sanitizedWidgets.filter(w => w.config.layout.y < firstSecY);
      if (preWidgets.length > 0) {
        const bottomY = preWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);
        placeholders.push({
          key: 'add_card_pre',
          x: 0,
          y: bottomY,
          w: 4,
          h: 2,
          type: 'add_card'
        });
      }

      // Inside each section
      sortedSections.forEach((section, idx) => {
        const secY = section.config.layout.y;
        const nextSec = sortedSections[idx + 1];
        const nextSecY = nextSec ? nextSec.config.layout.y : Infinity;

        const secWidgets = sanitizedWidgets.filter(w => w.id !== section.id && w.config.layout.y > secY && w.config.layout.y < nextSecY);
        const bottomY = secWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), secY + section.config.layout.h);
        placeholders.push({
          key: `add_card_${section.id}`,
          x: 0,
          y: bottomY,
          w: 4,
          h: 2,
          type: 'add_card'
        });
      });
    }

    // 2. Section placeholder at the absolute bottom
    const absoluteMaxY = sanitizedWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);
    placeholders.push({
      key: 'add_section_final',
      x: 0,
      y: absoluteMaxY + (placeholders.length > 0 ? 3 : 1),
      w: 12,
      h: 2,
      type: 'add_section'
    });

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
          "relative w-full grid gap-3 transition-all duration-500 sm:gap-4",
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
              "min-w-0 min-h-0 select-none transition-all duration-300 relative rounded-[1.75rem] sm:rounded-[2.5rem]",
              canEditLayout && "cursor-grab active:cursor-grabbing hover:z-10",
              selectedWidgetId === widget.id && isEditing && "z-10 ring-4 ring-primary ring-offset-4 ring-offset-background shadow-[0_0_50px_rgba(var(--primary),0.3)]"
            )}
          >
            <DashboardWidgetNode
              widget={widget}
              isEditing={canEditLayout}
              isSelected={selectedWidgetId === widget.id}
              onClick={() => onWidgetClick(widget.id)}
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
        {canEditLayout && virtualPlaceholders.map((placeholder) => (
          <button
            key={placeholder.key}
            type="button"
            style={{
              gridColumn: `${placeholder.x + 1} / span ${placeholder.w}`,
              gridRow: `${placeholder.y + 1} / span ${placeholder.h}`,
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-primary/20 hover:border-primary/50 bg-primary/[0.01] hover:bg-primary/[0.04] transition-all group/placeholder outline-none",
              placeholder.type === 'add_section' && "w-full border-border/40 hover:border-primary/40 bg-muted/5 hover:bg-primary/[0.02]"
            )}
            onClick={() => {
              if (placeholder.type === 'add_card') {
                onAddCardClick?.(placeholder.x, placeholder.y);
              } else {
                onAddSectionClick?.(placeholder.y);
              }
            }}
          >
            {placeholder.type === 'add_card' ? (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground/30 group-hover/placeholder:text-primary transition-colors">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-muted-foreground/30 group-hover/placeholder:border-primary/50">
                  <span className="text-lg font-black leading-none">+</span>
                </div>
              </div>
            ) : (
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 group-hover/placeholder:text-primary transition-colors">
                + Nueva Sección
              </span>
            )}
          </button>
        ))}

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
'@

Write-FileUtf8NoBom -Path $canvasPath -Content $canvas

# Shell del widget: contenedores con min-height correcto y radios móviles.
$dashboardWidgetPath = "apps/operator-console/src/views/dashboards/DashboardWidget.tsx"
Replace-InFile $dashboardWidgetPath '"relative h-full w-full overflow-hidden transition-all duration-300 group @container"' '"relative h-full w-full min-h-0 overflow-hidden transition-all duration-300 group @container touch-manipulation"'
Replace-InFile $dashboardWidgetPath ' : "rounded-[2rem]",' ' : "rounded-[1.5rem] sm:rounded-[2rem]",'
Replace-InFile $dashboardWidgetPath '<div className="h-full w-full">' '<div className="h-full w-full min-h-0">'
Replace-InFile $dashboardWidgetPath 'className="absolute bottom-1 right-1 z-40 w-8 h-8 flex items-end justify-end p-2 cursor-nwse-resize group/resize opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"' 'className="absolute bottom-1 right-1 z-40 hidden h-8 w-8 cursor-nwse-resize items-end justify-end p-2 opacity-0 transition-opacity active:scale-95 group-hover:opacity-100 group/resize lg:flex"'

# Device widget: íconos y padding por container query.
$devicePath = "apps/operator-console/src/views/dashboards/widgets/DeviceWidget.tsx"
Replace-InFile $devicePath '"relative h-full w-full flex flex-row items-center gap-3 px-3 py-1.5 transition-all duration-300 select-none group focus:outline-none"' '"relative h-full w-full flex flex-row items-center gap-3 px-3 py-2 @md:px-4 transition-all duration-300 select-none group focus:outline-none"'
Replace-InFile $devicePath '<IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />' '<IconComponent className="h-[clamp(1.25rem,12cqi,1.75rem)] w-[clamp(1.25rem,12cqi,1.75rem)]" />'
Replace-InFile $devicePath '"relative h-full w-full flex flex-col items-center justify-center p-3 transition-all duration-300 select-none group focus:outline-none"' '"relative h-full w-full flex flex-col items-center justify-center p-3 @md:p-4 transition-all duration-300 select-none group focus:outline-none"'
Replace-InFile $devicePath '<IconComponent className="w-[72%] h-[72%] max-w-[7rem] max-h-[7rem]" />' '<IconComponent className="h-[clamp(3rem,38cqi,7rem)] w-[clamp(3rem,38cqi,7rem)]" />'
Replace-InFile $devicePath '<div className="w-full text-center mt-auto pb-1">' '<div className="w-full min-w-0 text-center mt-auto pb-1">'

# Room widget.
$roomPath = "apps/operator-console/src/views/dashboards/widgets/RoomWidget.tsx"
Replace-InFile $roomPath '"relative h-full w-full flex flex-col p-7 transition-all duration-700"' '"relative h-full w-full min-h-0 flex flex-col p-4 @md:p-6 @lg:p-7 transition-all duration-700"'
Replace-InFile $roomPath 'className="flex items-center justify-between mb-6"' 'className="flex items-center justify-between mb-3 @md:mb-6"'
Replace-InFile $roomPath '"w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500"' '"w-10 h-10 @md:w-12 @md:h-12 rounded-2xl flex items-center justify-center border transition-all duration-500"'
Replace-InFile $roomPath '<Home className={cn("w-6 h-6", onCount > 0 ? "text-primary" : "text-muted-foreground/30")} />' '<Home className={cn("w-5 h-5 @md:w-6 @md:h-6", onCount > 0 ? "text-primary" : "text-muted-foreground/30")} />'
Replace-InFile $roomPath 'className="text-xl font-black tracking-tight text-foreground truncate"' 'className="text-base @md:text-xl font-black tracking-tight text-foreground truncate"'
Replace-InFile $roomPath '<div className="flex-1 space-y-4">' '<div className="flex-1 min-h-0 space-y-3 @md:space-y-4">'

# Scene shortcut.
$scenePath = "apps/operator-console/src/views/dashboards/widgets/SceneShortcutWidget.tsx"
Replace-InFile $scenePath '"relative h-full w-full flex flex-col justify-center items-center p-6 transition-all duration-500"' '"relative h-full w-full min-h-0 flex flex-col justify-center items-center p-4 @md:p-6 transition-all duration-500"'
Replace-InFile $scenePath '"w-16 h-16 rounded-[2rem] flex items-center justify-center border transition-all duration-500 mb-4"' '"w-12 h-12 @md:w-16 @md:h-16 rounded-[1.5rem] @md:rounded-[2rem] flex items-center justify-center border transition-all duration-500 mb-2 @md:mb-4"'
Replace-InFile $scenePath '<Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />' '<Loader2 className="w-6 h-6 @md:w-8 @md:h-8 text-primary-foreground animate-spin" />'
Replace-InFile $scenePath '<CheckCircle2 className="w-8 h-8" />' '<CheckCircle2 className="w-6 h-6 @md:w-8 @md:h-8" />'
Replace-InFile $scenePath '<PlaySquare className="w-8 h-8 text-primary" />' '<PlaySquare className="w-6 h-6 @md:w-8 @md:h-8 text-primary" />'
Replace-InFile $scenePath 'className="text-sm font-black tracking-tight text-foreground line-clamp-2 text-center leading-tight"' 'className="text-xs @md:text-sm font-black tracking-tight text-foreground line-clamp-2 text-center leading-tight"'

# Energy snapshot.
$energyPath = "apps/operator-console/src/views/dashboards/widgets/EnergySnapshotWidget.tsx"
Replace-InFile $energyPath '"relative w-full h-full rounded-[2.5rem] overflow-hidden p-6 transition-all duration-700"' '"relative w-full h-full min-h-0 rounded-[1.5rem] @md:rounded-[2.5rem] overflow-hidden p-4 @md:p-6 transition-all duration-700"'
Replace-InFile $energyPath 'className="flex items-center justify-between mb-6 relative z-10"' 'className="flex items-center justify-between mb-4 @md:mb-6 relative z-10"'
Replace-InFile $energyPath 'className="grid grid-cols-1 gap-6 relative z-10"' 'className="grid grid-cols-1 gap-4 @md:gap-6 relative z-10"'
Replace-InFile $energyPath 'className="text-4xl font-black tracking-tighter text-foreground tabular-nums"' 'className="text-[clamp(1.75rem,18cqi,2.25rem)] font-black tracking-tighter text-foreground tabular-nums"'
Replace-InFile $energyPath 'className="flex items-center justify-between p-4 rounded-3xl bg-muted/20 border border-border/40"' 'className="flex items-center justify-between gap-3 p-3 @md:p-4 rounded-2xl @md:rounded-3xl bg-muted/20 border border-border/40"'

# Assistant, Activity and System widgets.
$assistantPath = "apps/operator-console/src/views/dashboards/widgets/AssistantInsightWidget.tsx"
Replace-InFile $assistantPath '"flex flex-col h-full rounded-3xl p-5 transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 transition-all duration-500"'
Replace-InFile $assistantPath '<div className="flex items-center justify-between mb-4">' '<div className="flex items-center justify-between gap-2 mb-3 @md:mb-4">'
Replace-InFile $assistantPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'
Replace-InFile $assistantPath 'className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 px-4 italic opacity-80"' 'className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 px-2 @md:px-4 italic opacity-80"'

$activityPath = "apps/operator-console/src/views/dashboards/widgets/ActivityFeedWidget.tsx"
Replace-InFile $activityPath '"flex flex-col h-full rounded-3xl p-5 overflow-hidden transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 overflow-hidden transition-all duration-500"'
Replace-InFile $activityPath '<div className="flex items-center justify-between mb-4 shrink-0">' '<div className="flex items-center justify-between gap-2 mb-3 @md:mb-4 shrink-0">'
Replace-InFile $activityPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'
Replace-InFile $activityPath '<div className="flex-1 overflow-y-auto no-scrollbar space-y-3">' '<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 @md:space-y-3">'

$systemPath = "apps/operator-console/src/views/dashboards/widgets/SystemStatusWidget.tsx"
Replace-InFile $systemPath '"flex flex-col h-full rounded-3xl p-5 overflow-hidden transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 overflow-hidden transition-all duration-500"'
Replace-InFile $systemPath '<div className="flex items-center justify-between mb-5 shrink-0">' '<div className="flex items-center justify-between gap-2 mb-3 @md:mb-5 shrink-0">'
Replace-InFile $systemPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'
Replace-InFile $systemPath '<div className="space-y-5 animate-in fade-in duration-500">' '<div className="space-y-3 @md:space-y-5 animate-in fade-in duration-500">'
Replace-InFile $systemPath 'className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/10"' 'className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/10 min-w-0"'

# Section widget.
$sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx"
Replace-InFile $sectionPath 'className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/80 whitespace-nowrap"' 'className="truncate text-[11px] @md:text-[13px] font-black uppercase tracking-[0.18em] @md:tracking-[0.25em] text-foreground/80 whitespace-nowrap"'

Write-Host "OK: dashboard responsive aplicado." -ForegroundColor Green
Write-Host "Archivos principales: DashboardCanvas + DashboardWidget + widgets/*" -ForegroundColor Cyan
