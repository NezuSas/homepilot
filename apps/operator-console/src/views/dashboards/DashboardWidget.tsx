import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { DashboardWidget } from './types';
import { 
  Settings, 
  Trash2, 
  GripVertical
} from 'lucide-react';
import React from 'react';

// Sub-widgets
import { DeviceWidget } from './widgets/DeviceWidget';
import { RoomWidget } from './widgets/RoomWidget';
import { SceneShortcutWidget } from './widgets/SceneShortcutWidget';
import { ActivityFeedWidget } from './widgets/ActivityFeedWidget';
import { AssistantInsightWidget } from './widgets/AssistantInsightWidget';
import { SystemStatusWidget } from './widgets/SystemStatusWidget';
import { EnergySnapshotWidget } from './widgets/EnergySnapshotWidget';
import { ClockWidget } from './widgets/ClockWidget';

interface DashboardWidgetNodeProps {
  widget: DashboardWidget;
  isEditing: boolean;
  isSelected: boolean;
  onClick: () => void;
  onResizeEnd?: (id: string, w: number, h: number) => void;
}

export function DashboardWidgetNode({ 
  widget, 
  isEditing, 
  isSelected, 
  onClick,
  onResizeEnd
}: DashboardWidgetNodeProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeOffset, setResizeOffset] = React.useState({ w: 0, h: 0 });
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: widget.id,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'device_control':
        return <DeviceWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'room_overview':
      case 'room_summary':
        return <RoomWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'scene_shortcut':
        return <SceneShortcutWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'activity_feed':
        return <ActivityFeedWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'assistant_insight':
        return <AssistantInsightWidget config={widget.config} />;
      case 'system_status':
        return <SystemStatusWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'energy_snapshot':
        return <EnergySnapshotWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
      case 'clock_display':
        return <ClockWidget config={widget.config} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center opacity-40 grayscale">
            <span className="text-[10px] font-black uppercase tracking-widest">{widget.type}</span>
            <span className="text-[8px] mt-1">Próximamente</span>
          </div>
        );
    }
  };

  return (
    <div 
      ref={setNodeRef}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        ...style,
        ...(widget.config.appearance?.accentColor ? {
          borderTopColor: widget.config.appearance.accentColor,
          borderTopWidth: '3px',
          borderTopStyle: 'solid',
        } : {}),
      }}
      className={cn(
        "relative h-full w-full rounded-[2.5rem] overflow-hidden transition-all duration-500 group",
        
        // --- Variant Application ---
        widget.config.appearance?.variant === 'glass' && "bg-background/40 backdrop-blur-3xl border border-white/5 shadow-xl",
        (widget.config.appearance?.variant === 'solid' || !widget.config.appearance?.variant) && "bg-card border border-border/60",
        widget.config.appearance?.variant === 'radiant' && "bg-gradient-to-br from-card to-primary/5 border border-primary/20 shadow-lg shadow-primary/5",
        widget.config.appearance?.variant === 'outline' && "bg-transparent border-2 border-border/60",
        widget.config.appearance?.variant === 'flat' && "bg-muted/30 border-transparent",
        // ---------------------------
        
        isEditing && "ring-2 ring-transparent hover:ring-primary/20",
        isEditing && isSelected && "ring-primary shadow-2xl shadow-primary/20 scale-[1.01] z-10",
        isDragging && "opacity-0",
        !isEditing && "hover:shadow-xl hover:border-primary/20"
      )}
    >
      {/* Content Rendering */}
      <div className="h-full w-full">
        {renderWidgetContent()}
      </div>

      {/* Edit Mode Overlays & Controls */}
      {isEditing && (
        <>
          {/* Drag Handle Overlay (Invisible but covers content for dragging) */}
          <div 
            {...attributes} 
            {...listeners}
            className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing bg-primary/0"
          />

          {/* Control Bar */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur-md rounded-xl border border-border/40 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary">
                  <Settings className="w-3 h-3" />
               </button>
               <button className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
               </button>
            </div>
            <div className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg flex items-center justify-center">
               <GripVertical className="w-3 h-3" />
            </div>
          </div>

          {/* Manual Resize Handle (Bottom Right) */}
          <div 
            className="absolute bottom-1 right-1 z-40 w-8 h-8 flex items-end justify-end p-2 cursor-nwse-resize group/resize opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsResizing(true);
              
              const startX = e.clientX;
              const startY = e.clientY;
              const startW = widget.config.layout.w;
              const startH = widget.config.layout.h;

              // Find colWidth and rowHeight from parent grid
              const parent = (e.currentTarget.closest('.grid') as HTMLElement);
              if (!parent) return;
              const colWidth = parent.getBoundingClientRect().width / 12;
              // Read the live rowHeight from the grid's auto-rows style
              const gridAutoRows = getComputedStyle(parent).gridAutoRows;
              const rowHeight = parseFloat(gridAutoRows) || 40;

              const onMouseMove = (moveEvent: MouseEvent) => {
                const dw = Math.round((moveEvent.clientX - startX) / colWidth);
                const dh = Math.round((moveEvent.clientY - startY) / rowHeight);
                setResizeOffset({
                  w: Math.max(1 - startW, dw),
                  h: Math.max(1 - startH, dh)
                });
              };

              const onMouseUp = (upEvent: MouseEvent) => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                setIsResizing(false);
                
                const dw = Math.round((upEvent.clientX - startX) / colWidth);
                const dh = Math.round((upEvent.clientY - startY) / rowHeight);
                const finalW = Math.max(1, startW + dw);
                const finalH = Math.max(1, startH + dh);
                
                if (onResizeEnd && (finalW !== startW || finalH !== startH)) {
                  onResizeEnd(widget.id, finalW, finalH);
                }
                setResizeOffset({ w: 0, h: 0 });
              };

              window.addEventListener('mousemove', onMouseMove);
              window.addEventListener('mouseup', onMouseUp);
            }}
          >
             <div className="w-3 h-3 rounded-sm border-r-2 border-b-2 border-primary group-hover/resize:scale-110 transition-transform" />
          </div>

          {/* Visual Resize Preview Wrapper */}
          {isResizing && (
            <div className="absolute inset-0 pointer-events-none border-2 border-primary border-dashed rounded-[2.5rem] bg-primary/5 z-50">
               <div className="absolute bottom-2 right-4 text-[10px] font-black text-primary uppercase">
                 {widget.config.layout.w + resizeOffset.w} x {widget.config.layout.h + resizeOffset.h}
               </div>
            </div>
          )}

          {/* Selection Indicator */}
          {isSelected && (
            <div className="absolute inset-0 pointer-events-none ring-4 ring-primary/10 rounded-[2.5rem] animate-pulse" />
          )}
        </>
      )}
    </div>
  );
}
