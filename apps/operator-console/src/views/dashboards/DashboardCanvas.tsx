import { 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { DashboardWidget } from './types';
import { DashboardWidgetNode } from './DashboardWidget';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { useAssistantStore } from '../../stores/useAssistantStore';
import { isDeviceActive } from './dashboardUtils';

interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  isEditing: boolean;
  onWidgetClick: (id: string) => void;
  selectedWidgetId: string | null;
  onLayoutChange: (widgets: DashboardWidget[]) => void;
}

const GRID_COLS = 12;
const ROW_HEIGHT = 40;

export function DashboardCanvas({ 
  widgets, 
  isEditing, 
  onWidgetClick, 
  selectedWidgetId,
  onLayoutChange
}: DashboardCanvasProps) {
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { devices } = useDeviceSnapshotStore();
  const { findings } = useAssistantStore();

  const evaluateVisibility = (widget: DashboardWidget): boolean => {
    if (isEditing) return true; // Always show in edit mode
    
    const visibility = widget.config.visibility || { rules: [], defaultState: 'show' };
    const { rules, defaultState } = visibility;
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
  };

  const visibleWidgets = widgets.filter(evaluateVisibility);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditing) return;
    const widget = widgets.find((w) => w.id === event.active.id);
    if (widget) setActiveWidget(widget);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidget(null);
    const { active, delta } = event;
    
    if (!isEditing || !containerRef.current) return;

    const widget = widgets.find((w) => w.id === active.id);
    if (!widget) return;

    // Calculate grid cell dimensions from container
    const rect = containerRef.current.getBoundingClientRect();
    const colWidth = rect.width / GRID_COLS;
    
    // Calculate new x, y based on delta
    const dx = Math.round(delta.x / colWidth);
    const dy = Math.round(delta.y / ROW_HEIGHT);

    let newX = Math.max(0, Math.min(GRID_COLS - widget.config.layout.w, widget.config.layout.x + dx));
    let newY = Math.max(0, widget.config.layout.y + dy);

    // Collision Detection Logic
    const hasCollision = widgets.some(w => {
       if (w.id === widget.id) return false;
       return (
         newX < w.config.layout.x + w.config.layout.w &&
         newX + widget.config.layout.w > w.config.layout.x &&
         newY < w.config.layout.y + w.config.layout.h &&
         newY + widget.config.layout.h > w.config.layout.y
       );
    });

    // If collision, block or find next spot? User said "block or reorder". 
    // Blocking is cleaner for "serious control surface".
    if (hasCollision) {
      newX = widget.config.layout.x;
      newY = widget.config.layout.y;
    }

    if (newX !== widget.config.layout.x || newY !== widget.config.layout.y) {
      const updatedWidgets = widgets.map(w => 
        w.id === widget.id ? { ...w, config: { ...w.config, layout: { ...w.config.layout, x: newX, y: newY } } } : w
      );
      onLayoutChange(updatedWidgets);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={containerRef}
        className={cn(
          "relative w-full grid grid-cols-12 gap-4 p-4 transition-all duration-500",
          isEditing && "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:20px_20px] min-h-[800px] rounded-[3rem] border-2 border-dashed border-primary/10 shadow-2xl shadow-primary/5"
        )}
        style={{
          gridAutoRows: `${ROW_HEIGHT}px`,
        }}
      >
        {visibleWidgets.map((widget) => (
          <div
            key={widget.id}
            id={widget.id}
            style={{
              gridColumn: `${widget.config.layout.x + 1} / span ${widget.config.layout.w}`,
              gridRow: `${widget.config.layout.y + 1} / span ${widget.config.layout.h}`,
              opacity: activeWidget?.id === widget.id ? 0.3 : 1,
            }}
            className={cn(
              "select-none transition-all duration-300 relative rounded-[2.5rem]",
              isEditing && "cursor-grab active:cursor-grabbing hover:z-10",
              selectedWidgetId === widget.id && isEditing && "z-[200] ring-4 ring-primary ring-offset-4 ring-offset-background shadow-[0_0_50px_rgba(var(--primary),0.3)]"
            )}
          >
            <DashboardWidgetNode
              widget={widget}
              isEditing={isEditing}
              isSelected={selectedWidgetId === widget.id}
              onClick={() => onWidgetClick(widget.id)}
              onResizeEnd={(id, w, h) => {
                 // Collision Detection for Resize
                 const hasCollision = widgets.some(other => {
                    if (other.id === id) return false;
                    const layout = widget.config.layout;
                    const otherLayout = other.config.layout;
                    
                    return (
                      layout.x < otherLayout.x + otherLayout.w &&
                      layout.x + w > otherLayout.x &&
                      layout.y < otherLayout.y + otherLayout.h &&
                      layout.y + h > otherLayout.y
                    );
                 });

                 if (!hasCollision) {
                    const updatedWidgets = widgets.map(wgt => 
                       wgt.id === id ? { ...wgt, config: { ...wgt.config, layout: { ...wgt.config.layout, w, h } } } : wgt
                    );
                    onLayoutChange(updatedWidgets);
                 }
              }}
            />
          </div>
        ))}

        {/* Drag Overlay for smooth movement */}
        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
          {activeWidget ? (
            <div style={{
              width: containerRef.current ? (containerRef.current.getBoundingClientRect().width / GRID_COLS) * activeWidget.config.layout.w - 16 : 'auto',
              height: activeWidget.config.layout.h * ROW_HEIGHT - 16,
            }}>
              <DashboardWidgetNode
                widget={activeWidget}
                isEditing={true}
                isSelected={true}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
