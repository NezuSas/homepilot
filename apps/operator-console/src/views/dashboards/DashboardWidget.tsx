import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { useTranslation } from 'react-i18next';
import {
  Pencil,
  MoreVertical,
  Copy,
  GripVertical,
  Trash2
} from 'lucide-react';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../components/ui/IconButton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelectField } from '../../components/ui/SearchableSelectField';
import { Modal } from '../../components/ui/Modal';
import { getSectionSpan } from './dashboardUtils';
import { fitCardsToSectionWidth } from './widgets/cardGridResize';
import { IconPicker, getDashboardIconComponent } from './components/IconPicker';

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

/** Pure content renderer: no DnD hooks, safe to use inside DragOverlay. */
export function WidgetContent({ widget, isEditing, isSelected = false, onClick, onConfigChange, titleBadgeTabs, currentTabId, onSelectTab, titleEditorRequest, onTitleEditorOpenChange }: { widget: DashboardWidget; isEditing: boolean; isSelected?: boolean; onClick: () => void; onConfigChange?: (id: string, config: Partial<DashboardWidgetConfig>) => void; titleBadgeTabs?: Array<{ id: string; title: string; icon?: string }>; currentTabId?: string; onSelectTab?: (tabId: string) => void; titleEditorRequest?: number; onTitleEditorOpenChange?: (isOpen: boolean) => void }) {
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
          editRequest={titleEditorRequest}
          onEditorOpenChange={onTitleEditorOpenChange}
          onUpdate={(config) => onConfigChange?.(widget.id, config)}
          tabs={titleBadgeTabs}
          currentTabId={currentTabId}
          onSelectTab={onSelectTab}
        />
      );
    case 'section':
      return (
        <SectionWidget
          sectionId={widget.id}
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
  onDelete,
  onDuplicate,
  dragHandleAttributes,
  dragHandleListeners,
  titleBadgeTabs,
  currentTabId,
  onSelectTab,
}: DashboardWidgetNodeProps) {
  const { t } = useTranslation();
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
  const canConfigureWidget = widget.type !== 'clock_display';
  const SectionDraftIcon = sectionDraftIcon ? getDashboardIconComponent(sectionDraftIcon) : null;
  const openTitleEditor = () => {
    setIsTitleEditorOpen(true);
    onClick();
    setTitleEditorRequest((request) => request + 1);
  };


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
        "homepilot-dashboard-widget relative h-full w-full min-h-0 overflow-visible transition-[transform,box-shadow,background-color,border-color] duration-300 group @container touch-manipulation",
        // Editing restores the section boundary without changing its inner card grid.
        isSection
          ? (isEditing
            ? "homepilot-dashboard-section rounded-section outline outline-2 outline-dashed outline-offset-[-2px] outline-border/70 hover:outline-primary/70"
            : "homepilot-dashboard-section rounded-2xl border-transparent")
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
        isEditing && isSection && isSelected && "outline-primary bg-primary/5 shadow-primary-ring",
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
          titleEditorRequest={titleEditorRequest}
          onTitleEditorOpenChange={setIsTitleEditorOpen}
        />
      </div>
      {isSection ? (
        <Modal
          isOpen={isSectionEditorOpen}
          onClose={() => setIsSectionEditorOpen(false)}
          title={t('dashboard.editor.sections.edit_section_title')}
          headerAlign="start"
          className="max-w-md"
          footer={(
            <div className="flex w-full justify-end gap-3 p-5 sm:p-6">
              <Button type="button" variant="outline" size="md" onClick={() => setIsSectionEditorOpen(false)}>
                {t('dashboard.editor.sections.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  onConfigChange?.(widget.id, {
                    appearance: { ...widget.config.appearance, title: sectionDraftTitle.trim(), icon: sectionDraftIcon.trim() || undefined },
                    layout: { ...widget.config.layout, span: sectionDraftSpan },
                    extra: { ...widget.config.extra, sectionGridVersion: 2, ...(widget.config.extra?.cards ? { cards: fitCardsToSectionWidth(widget.config.extra.cards, getSectionSpan(widget), sectionDraftSpan) } : {}) },
                  });
                  setIsSectionEditorOpen(false);
                }}
              >
                {t('dashboard.editor.sections.save')}
              </Button>
            </div>
          )}
        >
          <div className="space-y-5">
            <SearchableSelectField label={t('dashboards.edit_session.section_width')} value={String(sectionDraftSpan)} options={[1, 2, 3, 4].map(value => ({ value: String(value), label: String(value) }))} onChange={value => setSectionDraftSpan(Number(value))} />
            <Input
              autoFocus
              label={t('dashboard.editor.sections.section_title')}
              value={sectionDraftTitle}
              placeholder={t('dashboard.editor.sections.section_title_placeholder')}
              onChange={(event) => setSectionDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsSectionEditorOpen(false);
              }}
            />
            <div className="space-y-2">
              <IconPicker value={sectionDraftIcon} onChange={setSectionDraftIcon} />
              {sectionDraftIcon && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSectionDraftIcon('')}>
                  {t('dashboard.editor.sections.remove_section_icon')}
                </Button>
              )}
            </div>
            <div role="group" aria-label={t('dashboard.editor.sections.section_preview')} className="rounded-xl border border-border/50 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-dashboard-section-title-fluid font-black tracking-tight text-foreground">
                {SectionDraftIcon && <SectionDraftIcon className="h-5 w-5 shrink-0 text-primary" />}
                <span className="min-w-0 truncate">{sectionDraftTitle.trim() || t('dashboard.editor.sections.new_section')}</span>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
      {isEditing && !isOverlay && isTitleWidget && !isTitleEditorOpen && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 rounded-section bg-background/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <IconButton
              icon={Pencil}
              label={t('common.edit')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                openTitleEditor();
              }}
              variant="default"
              size="md"
              className="pointer-events-auto rounded-full bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
            />
          </div>
          <div className="pointer-events-none absolute right-2 top-2 z-30 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <IconButton
              icon={MoreVertical}
              label={t('dashboard.editor.sections.card_actions')}
              aria-haspopup="menu"
              aria-expanded={isTitleMenuOpen}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                setTitleMenuPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
                setIsTitleMenuOpen((isOpen) => !isOpen);
              }}
              variant="default"
              size="md"
              className="rounded-full bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
            />
          </div>
          {isTitleMenuOpen && titleMenuPosition && createPortal(
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onPointerDown={() => setIsTitleMenuOpen(false)} />
              <div
                role="menu"
                aria-label={t('dashboard.editor.sections.card_actions')}
                style={titleMenuPosition}
                onPointerDown={(event) => event.stopPropagation()}
                className="fixed z-50 min-w-36 rounded-panel border border-border/70 bg-card p-1.5 shadow-depth-3"
              >
                <Button
                  role="menuitem"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsTitleMenuOpen(false);
                    openTitleEditor();
                  }}
                  className="w-full justify-start font-semibold"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t('common.edit')}
                </Button>
                <div role="separator" className="my-1 border-t border-border/65" />
                <Button
                  role="menuitem"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsTitleMenuOpen(false);
                    onDelete?.(widget.id);
                  }}
                  className="w-full justify-start font-semibold text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t('common.delete')}
                </Button>
              </div>
            </>,
            document.body,
          )}
        </>
      )}
      {/* Edit Mode Controls */}
      {isEditing && !isOverlay && !isTitleWidget && (
        <>
          {/* A selected section exposes only its direct manipulation tools. */}
          <div className={cn("pointer-events-auto absolute z-30 flex items-center", isSection ? "-top-5 right-3" : "right-2 top-2")}>
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/95 p-1 shadow-lg backdrop-blur-md">
              {isSection && <details className="relative" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
                <summary aria-label={t('dashboards.edit_session.section_actions')} className="grid h-11 w-11 cursor-pointer place-items-center rounded-control text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-primary [&::-webkit-details-marker]:hidden"><MoreVertical className="h-4 w-4" /></summary>
                <div role="menu" className="absolute right-0 top-full z-40 min-w-44 rounded-panel border border-border bg-card p-1.5 shadow-depth-3">
                  <Button role="menuitem" variant="ghost" className="w-full justify-start" onClick={event => {
                    const menu = event.currentTarget.closest('details'); if (menu) menu.open = false;
                    setSectionDraftTitle(widget.config.appearance?.title ?? ''); setSectionDraftIcon(widget.config.appearance?.icon ?? '');
                    setSectionDraftSpan(widget.config.extra?.sectionGridVersion === 2 ? widget.config.layout.span ?? 1 : 1); setIsSectionEditorOpen(true);
                  }}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>
                  <Button role="menuitem" variant="ghost" className="w-full justify-start" onClick={event => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; onDuplicate?.(widget.id); }}><Copy className="h-4 w-4" />{t('dashboards.edit_session.duplicate')}</Button>
                  <Button role="menuitem" variant="ghost" className="w-full justify-start text-danger" onClick={event => { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; onDelete?.(widget.id); }}><Trash2 className="h-4 w-4" />{t('common.delete')}</Button>
                </div>
              </details>}
              {/* The grip reorders the section without capturing its card controls. */}
              {!isTitleWidget && !isSection && canDrag && (
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
              {!isTitleWidget && !isSection && canDrag && (canConfigureWidget || Boolean(onDelete)) && <div className="mx-0.5 h-4 w-px bg-border/40" />}
              {canConfigureWidget && (
                <IconButton
                  icon={Pencil}
                  label={isSection ? t('dashboard.editor.sections.edit_section_title') : t('common.configure')}
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isSection) {
                      setSectionDraftTitle(widget.config.appearance?.title ?? '');
                      setSectionDraftIcon(widget.config.appearance?.icon ?? '');
                      setSectionDraftSpan(widget.config.extra?.sectionGridVersion === 2 ? widget.config.layout.span ?? 1 : 1);
                      setIsSectionEditorOpen(true);
                    } else {
                      onClick();
                    }
                  }}
                  className="hover:bg-primary/10 hover:text-primary"
                />
              )}
              {canConfigureWidget && !isTitleWidget && onDelete && <div className="mx-0.5 h-4 w-px bg-border/40" />}
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
        </>
      )}
    </div>
  );
}
