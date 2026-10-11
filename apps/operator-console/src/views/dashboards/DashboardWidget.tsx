import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useState } from 'react';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { getSectionSpan } from './dashboardUtils';
import { fitCardsToSectionWidth } from './widgets/cardGridResize';
import { getClockGridOptions } from './widgets/clock/clockRegistry';
import { WidgetContent } from './DashboardWidgetContent';
import { ClockSizeModal, SectionEditorModal } from './DashboardWidgetModals';
import { TitleEditControls, WidgetEditToolbar } from './DashboardWidgetControls';
import { getWidgetAccentStyle, getWidgetContentStyle, getWidgetFrameClass, getWidgetRootStyle } from './dashboardWidgetPresentation';

export { WidgetContent };

interface DashboardWidgetNodeProps {
  widget: DashboardWidget;
  isEditing: boolean;
  canDrag?: boolean;
  isSelected: boolean;
  isOverlay?: boolean;   // true when rendered inside DragOverlay (disables dnd registration)
  onClick: () => void;
  onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
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

export function DashboardWidgetNode({
  widget,
  isEditing,
  canDrag = true,
  isSelected,
  isOverlay = false,
  onClick,
  onConfigChange,
  onDelete,
  onDuplicate,
  dragHandleAttributes,
  dragHandleListeners,
  columns = 4,
  titleBadgeTabs,
  currentTabId,
  onSelectTab,
}: DashboardWidgetNodeProps) {
  const [isSectionEditorOpen, setIsSectionEditorOpen] = useState(false);
  const [sectionDraftTitle, setSectionDraftTitle] = useState('');
  const [sectionDraftIcon, setSectionDraftIcon] = useState('');
  const [sectionDraftSpan, setSectionDraftSpan] = useState(1);
  const [titleEditorRequest, setTitleEditorRequest] = useState(0);
  const [isTitleEditorOpen, setIsTitleEditorOpen] = useState(false);
  const [isTitleMenuOpen, setIsTitleMenuOpen] = useState(false);
  const [titleMenuPosition, setTitleMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const devices = useDeviceSnapshotStore(state => state.devices);
  const boundDevice = devices.find(d => d.id === widget.config.binding.entityId);
  const isCamera = widget.type === 'device_control' && (boundDevice?.type === 'camera' || boundDevice?.semanticType === 'camera');
  const isDevice = (widget.type === 'device_control' || widget.type === 'action_button') && !isCamera;
  const isSection = widget.type === 'section'; const isTitleWidget = widget.type === 'dashboard_title';
  const [clockEditorOpen, setClockEditorOpen] = useState(false);
  const [clockDraft, setClockDraft] = useState(getClockGridOptions);
  const [clockSectionWidth, setClockSectionWidth] = useState(300);
  const clockGrid = widget.type === 'clock_display' ? getClockGridOptions({ columns: widget.config.layout.w, rows: widget.config.layout.h }) : null;
  const hasClockEditTools = Boolean(clockGrid) && isEditing && !isOverlay;
  const openTitleEditor = () => {
    setIsTitleEditorOpen(true);
    onClick();
    setTitleEditorRequest((request) => request + 1);
  };
  const openSectionEditor = () => {
    setSectionDraftTitle(widget.config.appearance?.title ?? '');
    setSectionDraftIcon(widget.config.appearance?.icon ?? '');
    setSectionDraftSpan(widget.config.extra?.sectionGridVersion === 2 ? widget.config.layout.span ?? 1 : 1);
    setIsSectionEditorOpen(true);
  };
  const saveSectionEditor = () => {
    onConfigChange?.(widget.id, {
      appearance: { ...widget.config.appearance, title: sectionDraftTitle.trim(), icon: sectionDraftIcon.trim() || undefined },
      layout: { ...widget.config.layout, span: Math.min(sectionDraftSpan, columns) },
      extra: { ...widget.config.extra, sectionGridVersion: 2, ...(widget.config.extra?.cards ? { cards: fitCardsToSectionWidth(widget.config.extra.cards, getSectionSpan(widget), Math.min(sectionDraftSpan, columns)) } : {}) },
    });
    setIsSectionEditorOpen(false);
  };

  const accentColor = widget.config.appearance?.accentColor;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); if (!isSection) onClick(); }}
      style={getWidgetRootStyle(getWidgetAccentStyle(accentColor), clockGrid, hasClockEditTools)}
      className={getWidgetFrameClass({ isSection, isCamera, isDevice, isEditing, isSelected, hasClockEditTools, accentColor, variant: widget.config.appearance?.variant })}
    >
      {/* Content */}
      {widget.type === 'clock_display' && (
        <ClockSizeModal
          isOpen={clockEditorOpen}
          config={widget.config}
          draft={clockDraft}
          sectionWidth={clockSectionWidth}
          onDraftChange={setClockDraft}
          onSave={(size) => {
            onConfigChange?.(widget.id, { layout: { ...widget.config.layout, w: Number(size.columns), h: Number(size.rows) } });
            setClockEditorOpen(false);
          }}
          onClose={() => setClockEditorOpen(false)}
        />
      )}
      <div className="h-full w-full min-h-0" style={getWidgetContentStyle(clockGrid, hasClockEditTools)}>
        <WidgetContent
          widget={widget}
          isEditing={isEditing}
          isSelected={isSelected}
          onClick={onClick}
          onConfigChange={onConfigChange}
          titleBadgeTabs={titleBadgeTabs}
          currentTabId={currentTabId}
          onSelectTab={onSelectTab}
          titleEditorRequest={titleEditorRequest}
          onTitleEditorOpenChange={setIsTitleEditorOpen}
        />
      </div>
      {isSection ? (
        <SectionEditorModal
          isOpen={isSectionEditorOpen}
          columns={columns}
          draftTitle={sectionDraftTitle}
          draftIcon={sectionDraftIcon}
          draftSpan={sectionDraftSpan}
          onTitleChange={setSectionDraftTitle}
          onIconChange={setSectionDraftIcon}
          onSpanChange={setSectionDraftSpan}
          onSave={saveSectionEditor}
          onClose={() => setIsSectionEditorOpen(false)}
        />
      ) : null}
      {isEditing && !isOverlay && isTitleWidget && !isTitleEditorOpen && (
        <TitleEditControls
          isMenuOpen={isTitleMenuOpen}
          menuPosition={titleMenuPosition}
          onEdit={openTitleEditor}
          onToggleMenu={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setTitleMenuPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
            setIsTitleMenuOpen((isOpen) => !isOpen);
          }}
          onCloseMenu={() => setIsTitleMenuOpen(false)}
          onDelete={() => onDelete?.(widget.id)}
        />
      )}
      {/* Edit Mode Controls */}
      {isEditing && !isOverlay && !isTitleWidget && (
        <WidgetEditToolbar
          isSection={isSection}
          hasClockEditTools={hasClockEditTools}
          canDrag={canDrag}
          dragHandleAttributes={dragHandleAttributes}
          dragHandleListeners={dragHandleListeners}
          onEditSection={openSectionEditor}
          onConfigure={(event) => {
            if (clockGrid) {
              setClockDraft(clockGrid);
              setClockSectionWidth(event.currentTarget.closest('.homepilot-dashboard-widget')?.parentElement?.clientWidth ?? 300);
              setClockEditorOpen(true);
            } else {
              onClick();
            }
          }}
          onDuplicate={onDuplicate ? () => onDuplicate(widget.id) : undefined}
          onDelete={onDelete ? () => onDelete(widget.id) : undefined}
        />
      )}
    </div>
  );
}
