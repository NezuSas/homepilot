import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { useTranslation } from 'react-i18next';
import { 
  Pencil,
  GripVertical
} from 'lucide-react';
import React from 'react';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';

// Sub-widgets
import { DeviceWidget } from './widgets/DeviceWidget';
import { RoomWidget } from './widgets/RoomWidget';
import { SceneShortcutWidget } from './widgets/SceneShortcutWidget';
import { ActivityFeedWidget } from './widgets/ActivityFeedWidget';
import { AssistantInsightWidget } from './widgets/AssistantInsightWidget';
import { SystemStatusWidget } from './widgets/SystemStatusWidget';
import { EnergySnapshotWidget } from './widgets/EnergySnapshotWidget';
import { ClockWidget } from './widgets/ClockWidget';
import { SectionWidget } from './widgets/SectionWidget'; import { DashboardTitleWidget } from './widgets/DashboardTitleWidget';

interface DashboardWidgetNodeProps {
  widget: DashboardWidget;
  isEditing: boolean;
  canDrag?: boolean;
  isSelected: boolean;
  isOverlay?: boolean;   // true when rendered inside DragOverlay (disables dnd registration)
  onClick: () => void;
  onResizeEnd?: (id: string, w: number, h: number) => void;
  onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void;
}

/** Pure content renderer: no DnD hooks, safe to use inside DragOverlay. */
export function WidgetContent({ widget, isEditing, onClick, onConfigChange }: { widget: DashboardWidget; isEditing: boolean; onClick: () => void; onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void }) {
  const { t } = useTranslation();

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
    case 'dashboard_title':
      return <DashboardTitleWidget config={widget.config} isEditing={isEditing} />;
    case 'section':
      return (
        <SectionWidget
          config={widget.config}
          isEditing={isEditing}
          onUpdate={(patch) => onConfigChange?.(widget.id, patch)}
        />
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center opacity-40 grayscale">
          <span className="text-micro font-black uppercase tracking-widest">{widget.type}</span>
          <span className="text-nano mt-1">{t('common.coming_soon')}</span>
        </div>
      );
  }
}

export function DashboardWidgetNode({ 
  widget, 
  isEditing, 
  canDrag = true,
  isSelected, 
  isOverlay = false,
  onClick,
  onResizeEnd, onConfigChange
}: DashboardWidgetNodeProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeOffset, setResizeOffset] = React.useState({ w: 0, h: 0 });

  const devices = useDeviceSnapshotStore(state => state.devices);
  const boundDevice = devices.find(d => d.id === widget.config.binding.entityId);
  const isCamera = widget.type === 'device_control' && (boundDevice?.type === 'camera' || boundDevice?.semanticType === 'camera');
  const isDevice = widget.type === 'device_control' && !isCamera;
  const isSection = widget.type === 'section'; const isTitleWidget = widget.type === 'dashboard_title';

  // Never register dnd for section widgets or when rendering inside DragOverlay
  const isDndDisabled = !isEditing || !canDrag || isOverlay || isSection || isTitleWidget;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: widget.id,
    disabled: isDndDisabled,
  });

  // Only apply transform when actively dragging (not in overlay)
  const transformStyle = !isOverlay && transform ? { transform: CSS.Translate.toString(transform) } : {};

  const accentColor = widget.config.appearance?.accentColor;
  const accentStyle = accentColor
    ? {
        borderColor: accentColor,
        backgroundColor: `${accentColor}12`, // 7% opacity tint
        borderWidth: '2px',
        borderStyle: 'solid' as const,
      }
    : {};

  return (
    <div 
      ref={setNodeRef}
      onClick={(e) => { e.stopPropagation(); if (!isSection) onClick(); }}
      style={{ ...transformStyle, ...accentStyle, containerType: 'inline-size' }}
      className={cn(
        "relative h-full w-full min-h-0 overflow-visible transition-all duration-300 group @container touch-manipulation",
        // Section widgets and cameras are transparent shell-wise (camera handles its own rounded borders)
        isSection || isCamera
          ? "rounded-2xl bg-transparent border-transparent shadow-none"
          : "rounded-[1.5rem] sm:rounded-[2rem]",
        
        // --- Variant Application (non-section, non-camera) ---
        !isSection && !isCamera && !accentColor && isDevice && "bg-card border border-border/60 shadow-xl",
        !isSection && !isCamera && !accentColor && !isDevice && widget.config.appearance?.variant === 'glass' && "bg-background/40 backdrop-blur-3xl border border-white/5 shadow-xl",
        !isSection && !isCamera && !accentColor && !isDevice && (widget.config.appearance?.variant === 'solid' || !widget.config.appearance?.variant) && "bg-card border border-border/60",
        !isSection && !isCamera && !accentColor && widget.config.appearance?.variant === 'radiant' && "bg-gradient-to-br from-card to-primary/5 border border-primary/20 shadow-lg shadow-primary/5",
        !isSection && !isCamera && !accentColor && widget.config.appearance?.variant === 'outline' && "bg-transparent border-2 border-border/60",
        !isSection && !isCamera && !accentColor && widget.config.appearance?.variant === 'flat' && "bg-muted/30 border-transparent",
        // ---------------------------
        
        isEditing && !isSection && "ring-2 ring-transparent hover:ring-primary/20",
        isEditing && isSelected && !isSection && "ring-primary shadow-xl shadow-primary/10 scale-[1.005]",
        isDragging && "opacity-0",
        !isEditing && !isSection && "hover:shadow-lg hover:border-primary/20"
      )}
    >
      {/* Content */}
      <div className="h-full w-full min-h-0">
        <WidgetContent widget={widget} isEditing={isEditing} onClick={onClick} onConfigChange={onConfigChange} />
      </div>

      {/* Edit Mode Controls (not in overlay, not for section except delete) */}
      {isEditing && !isOverlay && (
        <>
          {/* Drag Handle (full area, not for sections) */}
          {!isSection && canDrag && (
            <div 
              {...attributes} 
              {...listeners}
              className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
            />
          )}

          {/* Floating control bar appears on hover */}
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-0.5 px-1.5 py-1 bg-background/90 backdrop-blur-md rounded-xl border border-border/40 shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-primary"
                title="Configurar"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {!isSection && canDrag && (
                <div className="w-px h-4 bg-border/40 mx-0.5" />
              )}
              {!isSection && canDrag && (
                <div className="p-1.5 text-muted-foreground/50">
                  <GripVertical className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>

          {/* Resize Handle (not for sections) */}
          {!isSection && onResizeEnd && (
            <div 
              className="absolute bottom-1 right-1 z-40 hidden h-8 w-8 cursor-nwse-resize items-end justify-end p-2 opacity-0 transition-opacity active:scale-95 group-hover:opacity-100 group/resize lg:flex"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsResizing(true);
                
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = widget.config.layout.w;
                const startH = widget.config.layout.h;

                const parent = (e.currentTarget.closest('.grid') as HTMLElement);
                if (!parent) return;
                const colWidth = parent.getBoundingClientRect().width / 12;
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
                  
                  if (finalW !== startW || finalH !== startH) {
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
          )}

          {/* Resize Preview */}
          {isResizing && (
            <div className="absolute inset-0 pointer-events-none border-2 border-primary border-dashed rounded-[2rem] bg-primary/5 z-50">
               <div className="absolute bottom-2 right-4 text-micro font-black text-primary uppercase">
                 {widget.config.layout.w + resizeOffset.w} × {widget.config.layout.h + resizeOffset.h}
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
