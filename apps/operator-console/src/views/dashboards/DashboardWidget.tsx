import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { useTranslation } from 'react-i18next';
import {
  Pencil,
  GripVertical
} from 'lucide-react';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { clampSectionSpan, getSectionSpan } from './dashboardUtils';

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
  onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  /** Sortable drag handle from the parent's useSortable(); spread onto the grip button. */
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: DraggableSyntheticListeners;
  /** Current breakpoint's column count, used to clamp the span picker. */
  columns?: number;
  /** Other tabs of this dashboard, forwarded to the title widget's tab-link badges. */
  titleBadgeTabs?: Array<{ id: string; title: string; icon?: string }>;
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

/** Pure content renderer: no DnD hooks, safe to use inside DragOverlay. */
export function WidgetContent({ widget, isEditing, isSelected = false, onClick, onConfigChange, titleBadgeTabs, currentTabId, onSelectTab }: { widget: DashboardWidget; isEditing: boolean; isSelected?: boolean; onClick: () => void; onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void; titleBadgeTabs?: Array<{ id: string; title: string; icon?: string }>; currentTabId?: string; onSelectTab?: (tabId: string) => void }) {
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
  onConfigChange,
  dragHandleAttributes,
  dragHandleListeners,
  columns = 3,
  titleBadgeTabs,
  currentTabId,
  onSelectTab,
}: DashboardWidgetNodeProps) {
  const { t } = useTranslation();

  const devices = useDeviceSnapshotStore(state => state.devices);
  const boundDevice = devices.find(d => d.id === widget.config.binding.entityId);
  const isCamera = widget.type === 'device_control' && (boundDevice?.type === 'camera' || boundDevice?.semanticType === 'camera');
  const isDevice = widget.type === 'device_control' && !isCamera;
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
        "relative h-full w-full min-h-0 overflow-visible transition-all duration-300 group @container touch-manipulation",
        // Section widgets and cameras are transparent shell-wise (camera handles its own rounded borders)
        isSection || isCamera
          ? "rounded-2xl bg-transparent border-transparent shadow-none"
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
        />
      </div>

      {/* Edit Mode Controls */}
      {isEditing && !isOverlay && (
        <>
          {/* Floating control bar appears on hover */}
          <div className="pointer-events-auto absolute right-2 top-2 z-30 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/95 p-1 shadow-lg backdrop-blur-md">
              <IconButton
                icon={Pencil}
                label={t('common.configure')}
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="hover:bg-primary/10 hover:text-primary"
              />
              {!isTitleWidget && canDrag && onConfigChange && (
                <div className="w-px h-4 bg-border/40 mx-0.5" />
              )}
              {/* Discrete column-span picker: 1..N columns, Home Assistant Sections style. */}
              {!isTitleWidget && canDrag && onConfigChange && (
                <div onClick={(event) => event.stopPropagation()}>
                  <SegmentedControl<string>
                    value={String(clampSectionSpan(getSectionSpan(widget), Math.max(1, columns)))}
                    onChange={(value) => onConfigChange(widget.id, { layout: { ...widget.config.layout, span: Number(value) } })}
                    options={Array.from({ length: Math.max(1, columns) }, (_, index) => index + 1).map((option) => ({
                      value: String(option),
                      label: String(option),
                    }))}
                    className="gap-0.5 rounded-lg border-0 bg-muted/40 p-0.5"
                    optionClassName="min-h-8 min-w-6 flex-none rounded px-1 py-1 text-micro font-black"
                  />
                </div>
              )}
              {!isTitleWidget && canDrag && (
                <div className="w-px h-4 bg-border/40 mx-0.5" />
              )}
              {/* Dedicated grip handle: reorders the zone without capturing clicks
                  on the cards/controls rendered inside it. */}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
