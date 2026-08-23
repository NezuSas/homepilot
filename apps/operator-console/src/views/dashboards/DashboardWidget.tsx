import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { useTranslation } from 'react-i18next';
import {
  Maximize2,
  Pencil,
  GripVertical,
  Trash2
} from 'lucide-react';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../components/ui/IconButton';
import { clampSectionSpan, getSectionSpan } from './dashboardUtils';

// Sub-widgets
import { DeviceWidget } from './widgets/DeviceWidget';
import { ActionButtonWidget } from './widgets/ActionButtonWidget';
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
  onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onDelete?: (id: string) => void;
  /** Sortable drag handle from the parent's useSortable(); spread onto the grip button. */
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: DraggableSyntheticListeners;
  /** Current breakpoint's column count, used to constrain resize interactions. */
  columns?: number;
  /** Other tabs of this dashboard, forwarded to the title widget's tab-link badges. */
  titleBadgeTabs?: Array<{ id: string; title: string; icon?: string }>;
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

/** Pure content renderer: no DnD hooks, safe to use inside DragOverlay. */
export function WidgetContent({ widget, isEditing, isSelected = false, onClick, onConfigChange, titleBadgeTabs, currentTabId, onSelectTab, sectionTitleEditRequest }: { widget: DashboardWidget; isEditing: boolean; isSelected?: boolean; onClick: () => void; onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void; titleBadgeTabs?: Array<{ id: string; title: string; icon?: string }>; currentTabId?: string; onSelectTab?: (tabId: string) => void; sectionTitleEditRequest?: number }) {
  const { t } = useTranslation();

  switch (widget.type) {
    case 'device_control':
      return <DeviceWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
    case 'action_button':
      return <ActionButtonWidget config={widget.config} isEditing={isEditing} onConfigure={onClick} />;
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
      return (
        <DashboardTitleWidget
          config={widget.config}
          isEditing={isEditing}
          isSelected={isSelected}
          onUpdate={(config) => onConfigChange?.(widget.id, config)}
          tabs={titleBadgeTabs}
          currentTabId={currentTabId}
          onSelectTab={onSelectTab}
        />
      );
    case 'section':
      return (
        <SectionWidget
          config={widget.config}
          isEditing={isEditing}
          onUpdate={(patch) => onConfigChange?.(widget.id, patch)}
          editTitleRequest={sectionTitleEditRequest}
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

const WIDGET_RESIZE_STEP_PX = 56;

/** Drag-to-resize corner handle, snapping to the same 1..columns steps the segmented control offers. */
function WidgetResizeHandle({
  span,
  columns,
  label,
  onResize,
}: {
  span: number;
  columns: number;
  label: string;
  onResize: (nextSpan: number) => void;
}) {
  const dragStartRef = useRef<{ x: number; span: number } | null>(null);

  return (
    <span
      role="slider"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={columns}
      aria-valuenow={span}
      tabIndex={0}
      title={label}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' && span < columns) {
          event.preventDefault();
          onResize(span + 1);
        } else if (event.key === 'ArrowLeft' && span > 1) {
          event.preventDefault();
          onResize(span - 1);
        }
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartRef.current = { x: event.clientX, span };
      }}
      onPointerMove={(event) => {
        const start = dragStartRef.current;
        if (!start) return;
        const deltaSteps = Math.round((event.clientX - start.x) / WIDGET_RESIZE_STEP_PX);
        const nextSpan = Math.min(columns, Math.max(1, start.span + deltaSteps));
        if (nextSpan !== span) onResize(nextSpan);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragStartRef.current = null;
      }}
      className="pointer-events-auto absolute bottom-2 right-2 z-30 grid h-7 w-7 cursor-nwse-resize touch-none place-items-center rounded-lg border border-border/50 bg-background/95 text-muted-foreground opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 [@media(hover:none)]:opacity-100"
    >
      <Maximize2 className="h-3.5 w-3.5 rotate-90" />
    </span>
  );
}

export function DashboardWidgetNode({
  widget,
  isEditing,
  canDrag = true,
  isSelected,
  isOverlay = false,
  onClick,
  onConfigChange,
  onDelete,
  dragHandleAttributes,
  dragHandleListeners,
  columns = 3,
  titleBadgeTabs,
  currentTabId,
  onSelectTab,
}: DashboardWidgetNodeProps) {
  const { t } = useTranslation();
  const [sectionTitleEditRequest, setSectionTitleEditRequest] = useState(0);

  const devices = useDeviceSnapshotStore(state => state.devices);
  const boundDevice = devices.find(d => d.id === widget.config.binding.entityId);
  const isCamera = widget.type === 'device_control' && (boundDevice?.type === 'camera' || boundDevice?.semanticType === 'camera');
  const isDevice = (widget.type === 'device_control' || widget.type === 'action_button') && !isCamera;
  const isSection = widget.type === 'section'; const isTitleWidget = widget.type === 'dashboard_title';

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
      onClick={(e) => { e.stopPropagation(); if (!isSection) onClick(); }}
      style={{ ...accentStyle, containerType: 'inline-size' }}
      className={cn(
        "homepilot-dashboard-widget relative h-full w-full min-h-0 overflow-visible transition-all duration-300 group @container touch-manipulation",
        // Editing restores the section boundary without changing its inner card grid.
        isSection
          ? (isEditing
            ? "rounded-section border-2 border-dashed border-border/70 bg-background/10 p-3 shadow-sm transition-colors hover:border-primary/70"
            : "rounded-2xl border-transparent bg-transparent shadow-none")
          : isCamera
            ? "rounded-2xl border-transparent bg-transparent shadow-none"
            : "rounded-section sm:rounded-panel",

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
        isEditing && isSection && isSelected && "border-primary bg-primary/5 shadow-primary-ring",
        !isEditing && !isSection && "hover:shadow-lg hover:border-primary/20"
      )}
    >
      {/* Content */}
      <div className="h-full w-full min-h-0">
        <WidgetContent
          widget={widget}
          isEditing={isEditing}
          isSelected={isSelected}
          onClick={onClick}
          onConfigChange={onConfigChange}
          titleBadgeTabs={titleBadgeTabs}
          currentTabId={currentTabId}
          onSelectTab={onSelectTab}
          sectionTitleEditRequest={sectionTitleEditRequest}
        />
      </div>

      {/* Edit Mode Controls */}
      {isEditing && !isOverlay && (
        <>
          {/* A selected section exposes only its direct manipulation tools. */}
          <div className="pointer-events-auto absolute right-2 top-2 z-30 flex items-center">
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/95 p-1 shadow-lg backdrop-blur-md">
              {/* The grip reorders the section without capturing its card controls. */}
              {!isTitleWidget && canDrag && (
                <IconButton
                  icon={GripVertical}
                  label={t('common.reorder')}
                  variant="ghost"
                  size="sm"
                  {...dragHandleAttributes}
                  {...dragHandleListeners}
                  className="h-9 w-7 touch-none cursor-grab text-muted-foreground/50 active:cursor-grabbing hover:text-primary"
                />
              )}
              {!isTitleWidget && canDrag && <div className="mx-0.5 h-4 w-px bg-border/40" />}
              <IconButton
                icon={Pencil}
                label={t('common.configure')}
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); if (isSection) { setSectionTitleEditRequest((request) => request + 1); } else { onClick(); } }}
                className="hover:bg-primary/10 hover:text-primary"
              />
              {!isTitleWidget && onDelete && <div className="mx-0.5 h-4 w-px bg-border/40" />}
              {!isTitleWidget && onDelete && (
                <IconButton
                  icon={Trash2}
                  label={t('common.delete')}
                  variant="ghost"
                  size="sm"
                  onClick={(event) => { event.stopPropagation(); onDelete(widget.id); }}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                />
              )}
            </div>
          </div>
          {!isTitleWidget && canDrag && onConfigChange && (
            <WidgetResizeHandle
              span={clampSectionSpan(getSectionSpan(widget), Math.max(1, columns))}
              columns={Math.max(1, columns)}
              label={t('dashboard.editor.sections.resize_card')}
              onResize={(nextSpan) => onConfigChange(widget.id, { layout: { ...widget.config.layout, span: nextSpan } })}
            />
          )}
        </>
      )}
    </div>
  );
}
