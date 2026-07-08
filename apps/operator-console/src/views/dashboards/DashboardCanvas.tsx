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

const GRID_COLS = 12;
// Minimum row height in pixels. The actual rowHeight is derived from colWidth
// so the grid stays proportional at any screen size.
const MIN_ROW_HEIGHT = 40;
const MAX_ROW_HEIGHT = 80;

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
  const [colWidth, setColWidth] = useState(0);
  const rowHeight = colWidth > 0
    ? Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Math.round(colWidth * 0.7)))
    : MIN_ROW_HEIGHT;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setColWidth(width / GRID_COLS);
    });
    observer.observe(el);
    // Set immediately on mount
    setColWidth(el.getBoundingClientRect().width / GRID_COLS);
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

  // Compute virtual placeholders for HASS-style add-card and add-section buttons
  const virtualPlaceholders = useMemo(() => {
    if (!isEditing) return [];

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
  }, [sanitizedWidgets, isEditing]);

  const canvasMinRows = useMemo(() => {
    const bottomY = sanitizedWidgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);
    return Math.max(8, bottomY + (isEditing ? 6 : 2));
  }, [sanitizedWidgets, isEditing]);

  const sensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions)
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditing) return;
    const widget = sanitizedWidgets.find((w) => w.id === event.active.id);
    if (widget) {
      setActiveWidget(widget);
      setSnapPreview({ x: widget.config.layout.x, y: widget.config.layout.y, w: widget.config.layout.w, h: widget.config.layout.h });
    }
  };

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!isEditing || colWidth === 0) return;
    const widget = sanitizedWidgets.find((w) => w.id === event.active.id);
    if (!widget) return;
    const dx = Math.round(event.delta.x / colWidth);
    const dy = Math.round(event.delta.y / rowHeight);
    const newX = Math.max(0, Math.min(GRID_COLS - widget.config.layout.w, widget.config.layout.x + dx));
    const newY = Math.max(0, widget.config.layout.y + dy);
    setSnapPreview({ x: newX, y: newY, w: widget.config.layout.w, h: widget.config.layout.h });
  }, [isEditing, colWidth, rowHeight, sanitizedWidgets]);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    setSnapPreview(null);
    const { active, delta } = event;
    
    if (!isEditing || colWidth === 0) return;

    const widget = sanitizedWidgets.find((w) => w.id === active.id);
    if (!widget) return;

    const dx = Math.round(delta.x / colWidth);
    const dy = Math.round(delta.y / rowHeight);

    // Clamp so widget never exits the grid horizontally
    const newX = Math.max(0, Math.min(GRID_COLS - widget.config.layout.w, widget.config.layout.x + dx));
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
          "relative w-full grid grid-cols-12 gap-3 transition-all duration-500 sm:gap-4",
          isEditing
            ? "border-2 border-dashed border-primary/10 bg-card/20 p-3 sm:p-4 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:20px_20px] shadow-2xl shadow-primary/5"
            : "border-transparent bg-transparent p-0"
        )}
        style={{
          gridAutoRows: `${rowHeight}px`,
          minHeight: `${canvasMinRows * rowHeight}px`,
        }}
      >
        {visibleWidgets.map((widget) => (
          <div
            key={widget.id}
            id={widget.id}
            style={{
              gridColumn: `${widget.config.layout.x + 1} / span ${Math.min(widget.config.layout.w, GRID_COLS - widget.config.layout.x)}`,
              gridRow: `${widget.config.layout.y + 1} / span ${widget.config.layout.h}`,
              opacity: activeWidget?.id === widget.id ? 0.3 : 1,
            }}
            className={cn(
              "min-w-0 select-none transition-all duration-300 relative rounded-[2.5rem]",
              isEditing && "cursor-grab active:cursor-grabbing hover:z-10",
              selectedWidgetId === widget.id && isEditing && "z-10 ring-4 ring-primary ring-offset-4 ring-offset-background shadow-[0_0_50px_rgba(var(--primary),0.3)]"
            )}
          >
            <DashboardWidgetNode
              widget={widget}
              isEditing={isEditing}
              isSelected={selectedWidgetId === widget.id}
              onClick={() => onWidgetClick(widget.id)}
              onResizeEnd={(id, w, h) => {
                 // Clamp width so widget never exits the grid
                 const layout = widget.config.layout;
                 const clampedW = Math.min(w, GRID_COLS - layout.x);
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
        {isEditing && virtualPlaceholders.map((placeholder) => (
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
        {isEditing && snapPreview && activeWidget && (
          <div
            aria-hidden="true"
            style={{
              gridColumn: `${snapPreview.x + 1} / span ${Math.min(snapPreview.w, GRID_COLS - snapPreview.x)}`,
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
          {activeWidget && colWidth > 0 ? (
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
